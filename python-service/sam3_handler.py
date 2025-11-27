"""
Custom Inference Handler for SAM3 (Segment Anything Model 3)

This handler enables text-prompted image segmentation via Hugging Face Inference Endpoints.

Usage:
    POST to your endpoint with:
    {
        "inputs": "<base64_encoded_image>",
        "prompt": "mouse genitalia"
    }

Returns:
    List of segmentation results with masks encoded as base64 PNG images.

To deploy:
1. Fork facebook/sam3 on Hugging Face (use https://huggingface.co/spaces/osanseviero/repo_duplicator)
2. Add this file as handler.py to your forked repo
3. Add requirements.txt with: pillow, numpy
4. Deploy via Inference Endpoints
"""

from typing import Dict, List, Any
import base64
import io
import numpy as np
from PIL import Image
import torch


class EndpointHandler:
    def __init__(self, path: str = ""):
        """
        Initialize the SAM3 model.
        
        Args:
            path: Path to the model weights (provided by HF Inference Endpoints)
        """
        from transformers import Sam3Processor, Sam3Model
        
        print(f"Loading SAM3 from {path}...")
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
        self.processor = Sam3Processor.from_pretrained(path)
        self.model = Sam3Model.from_pretrained(path).to(self.device)
        self.model.eval()
        
        print("SAM3 loaded successfully!")

    def __call__(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process a segmentation request.
        
        Args:
            data: Dictionary containing:
                - inputs: Base64 encoded image OR raw image bytes
                - prompt: Text prompt for segmentation (e.g., "mouse genitalia")
                - return_mask: If True, return mask as base64 PNG (default: True)
                - threshold: Confidence threshold (default: 0.5)
        
        Returns:
            List of dictionaries with segmentation results
        """
        try:
            # Extract inputs
            inputs = data.get("inputs", data)
            prompt = data.get("prompt", "object")
            return_mask = data.get("return_mask", True)
            threshold = data.get("threshold", 0.5)
            
            # Decode image
            if isinstance(inputs, str):
                # Base64 encoded
                image_bytes = base64.b64decode(inputs)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            elif isinstance(inputs, bytes):
                # Raw bytes
                image = Image.open(io.BytesIO(inputs)).convert("RGB")
            elif isinstance(inputs, Image.Image):
                image = inputs.convert("RGB")
            else:
                return [{"error": f"Unsupported input type: {type(inputs)}"}]
            
            original_size = image.size  # (W, H)
            
            # Process with SAM3
            processor_inputs = self.processor(
                images=image,
                text=prompt,
                return_tensors="pt"
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**processor_inputs)
            
            # Get masks and scores
            pred_masks = outputs.pred_masks  # [batch, num_queries, H, W]
            pred_logits = outputs.pred_logits  # [batch, num_queries]
            
            # Convert logits to scores
            scores = pred_logits[0].sigmoid().cpu().numpy()
            
            # Find masks above threshold
            results = []
            
            for idx, score in enumerate(scores):
                if score < threshold:
                    continue
                
                # Get mask and resize to original size
                mask = pred_masks[0, idx]
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0),
                    size=(original_size[1], original_size[0]),  # (H, W)
                    mode="bilinear",
                    align_corners=False
                ).squeeze()
                
                # Threshold mask
                mask_np = (mask > 0).cpu().numpy().astype(np.uint8) * 255
                
                # Find bounding box
                rows = np.any(mask_np > 0, axis=1)
                cols = np.any(mask_np > 0, axis=0)
                
                if not rows.any() or not cols.any():
                    continue
                
                ymin, ymax = np.where(rows)[0][[0, -1]]
                xmin, xmax = np.where(cols)[0][[0, -1]]
                
                result = {
                    "score": float(score),
                    "label": prompt,
                    "box": {
                        "xmin": int(xmin),
                        "ymin": int(ymin),
                        "xmax": int(xmax),
                        "ymax": int(ymax)
                    }
                }
                
                # Optionally return mask as base64 PNG
                if return_mask:
                    mask_img = Image.fromarray(mask_np, mode="L")
                    mask_buffer = io.BytesIO()
                    mask_img.save(mask_buffer, format="PNG")
                    mask_b64 = base64.b64encode(mask_buffer.getvalue()).decode("utf-8")
                    result["mask"] = mask_b64
                
                results.append(result)
            
            # Sort by score descending
            results.sort(key=lambda x: x["score"], reverse=True)
            
            # Return at least the best result even if below threshold
            if not results and len(scores) > 0:
                best_idx = scores.argmax()
                mask = pred_masks[0, best_idx]
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0),
                    size=(original_size[1], original_size[0]),
                    mode="bilinear",
                    align_corners=False
                ).squeeze()
                
                mask_np = (mask > 0).cpu().numpy().astype(np.uint8) * 255
                
                rows = np.any(mask_np > 0, axis=1)
                cols = np.any(mask_np > 0, axis=0)
                
                if rows.any() and cols.any():
                    ymin, ymax = np.where(rows)[0][[0, -1]]
                    xmin, xmax = np.where(cols)[0][[0, -1]]
                    
                    result = {
                        "score": float(scores[best_idx]),
                        "label": prompt,
                        "box": {
                            "xmin": int(xmin),
                            "ymin": int(ymin),
                            "xmax": int(xmax),
                            "ymax": int(ymax)
                        }
                    }
                    
                    if return_mask:
                        mask_img = Image.fromarray(mask_np, mode="L")
                        mask_buffer = io.BytesIO()
                        mask_img.save(mask_buffer, format="PNG")
                        result["mask"] = base64.b64encode(mask_buffer.getvalue()).decode("utf-8")
                    
                    results.append(result)
            
            return results
            
        except Exception as e:
            import traceback
            return [{"error": str(e), "traceback": traceback.format_exc()}]


# For local testing
if __name__ == "__main__":
    import sys
    
    # Test with a sample image
    handler = EndpointHandler(path="facebook/sam3")
    
    # Load test image
    test_image_path = sys.argv[1] if len(sys.argv) > 1 else "../dataset_raw/ESTRUS/AI11_1_EST.jpg"
    
    with open(test_image_path, "rb") as f:
        image_bytes = f.read()
    
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    result = handler({
        "inputs": image_b64,
        "prompt": "mouse genitalia",
        "threshold": 0.1
    })
    
    print(f"Results: {len(result)} segments found")
    for r in result:
        if "error" in r:
            print(f"Error: {r['error']}")
        else:
            print(f"  Score: {r['score']:.3f}, Box: {r['box']}")




