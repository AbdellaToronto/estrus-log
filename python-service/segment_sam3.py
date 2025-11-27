"""
SAM3 Segmentation Script with Background Removal

Uses Meta's SAM3 model for text-prompted segmentation (Promptable Concept Segmentation).
Removes background using the segmentation mask - outputs either:
- Transparent PNG (alpha channel)
- Solid color background (e.g., black)
"""

import os
import sys
from PIL import Image
import torch
import torch.nn.functional as F
import numpy as np
from tqdm import tqdm
from dotenv import load_dotenv
import argparse

load_dotenv()

# Directories
RAW_DIR = "../dataset_raw"
OUTPUT_DIR = "../dataset_sam3_cropped"
PROMPT = "mouse genitalia"

# SAM3 model
sam3_processor = None
sam3_model = None


def load_sam3():
    """Load SAM3 model from Hugging Face."""
    global sam3_processor, sam3_model
    
    print("Loading SAM3 model...")
    
    try:
        from transformers import Sam3Processor, Sam3Model
        
        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN not found in environment")
        
        sam3_processor = Sam3Processor.from_pretrained("facebook/sam3", token=hf_token)
        sam3_model = Sam3Model.from_pretrained("facebook/sam3", token=hf_token)
        sam3_model.eval()
        
        print("SAM3 loaded successfully!")
        return True
        
    except Exception as e:
        print(f"Error loading SAM3: {e}")
        import traceback
        traceback.print_exc()
        return False


def segment_with_sam3(image: Image.Image, prompt: str, bg_mode: str = "crop", bg_color: tuple = (0, 0, 0)):
    """
    Segment image using SAM3 with text prompt.
    
    Args:
        image: PIL Image to segment
        prompt: Text prompt for segmentation (e.g., "mouse genitalia")
        bg_mode: One of:
            - "crop": Just crop to bounding box (original behavior)
            - "transparent": Remove background with transparency (PNG)
            - "solid": Replace background with solid color
            - "mask_crop": Crop AND apply mask (best of both worlds)
        bg_color: RGB tuple for solid background (default black)
    
    Returns:
        Processed image or None if segmentation fails
    """
    if sam3_model is None or sam3_processor is None:
        return None
    
    try:
        original_size = image.size  # (W, H)
        
        # Process inputs
        inputs = sam3_processor(images=image, text=prompt, return_tensors="pt")
        
        # Run inference
        with torch.no_grad():
            outputs = sam3_model(**inputs)
        
        # Get masks - shape is [batch, num_queries, H, W]
        pred_masks = outputs.pred_masks  # [1, 200, 288, 288]
        pred_logits = outputs.pred_logits  # [1, 200] - confidence scores per query
        
        # Get the best mask (highest confidence for our text query)
        if pred_logits is not None:
            scores = pred_logits[0].sigmoid()  # [200]
            best_idx = scores.argmax().item()
            best_score = scores[best_idx].item()
            
            if best_score < 0.1:  # Threshold
                print(f"  Low confidence: {best_score:.3f}")
                return None
            
            # Get the best mask
            mask = pred_masks[0, best_idx]  # [288, 288]
        else:
            # Fallback: use first mask
            mask = pred_masks[0, 0]
        
        # Resize mask to original image size
        mask = F.interpolate(
            mask.unsqueeze(0).unsqueeze(0),
            size=(original_size[1], original_size[0]),  # (H, W)
            mode="bilinear",
            align_corners=False
        ).squeeze()
        
        # Create binary mask (soft edges preserved for quality)
        mask_soft = torch.clamp(mask, 0, 1).cpu().numpy()
        mask_binary = (mask_soft > 0.5).astype(np.uint8)
        
        # Find bounding box from mask
        rows = np.any(mask_binary, axis=1)
        cols = np.any(mask_binary, axis=0)
        
        if not rows.any() or not cols.any():
            return None
        
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        
        # Add padding
        w, h = original_size
        padding = 30
        xmin = max(0, xmin - padding)
        ymin = max(0, ymin - padding)
        xmax = min(w, xmax + padding)
        ymax = min(h, ymax + padding)
        
        # Convert image to numpy
        img_np = np.array(image)
        
        if bg_mode == "crop":
            # Original behavior: just crop
            return image.crop((xmin, ymin, xmax, ymax))
        
        elif bg_mode == "transparent":
            # Create RGBA image with transparency
            alpha = (mask_soft * 255).astype(np.uint8)
            rgba = np.dstack([img_np, alpha])
            result = Image.fromarray(rgba, mode="RGBA")
            # Crop to bounding box
            return result.crop((xmin, ymin, xmax, ymax))
        
        elif bg_mode == "solid":
            # Replace background with solid color
            bg = np.full_like(img_np, bg_color)
            mask_3d = np.stack([mask_soft] * 3, axis=-1)
            blended = (img_np * mask_3d + bg * (1 - mask_3d)).astype(np.uint8)
            result = Image.fromarray(blended)
            # Crop to bounding box
            return result.crop((xmin, ymin, xmax, ymax))
        
        elif bg_mode == "mask_crop":
            # Crop first, then apply mask (smaller file, clean edges)
            # Crop the mask and image together
            cropped_img = img_np[ymin:ymax, xmin:xmax]
            cropped_mask = mask_soft[ymin:ymax, xmin:xmax]
            
            # Create solid background for cropped region
            bg = np.full_like(cropped_img, bg_color)
            mask_3d = np.stack([cropped_mask] * 3, axis=-1)
            blended = (cropped_img * mask_3d + bg * (1 - mask_3d)).astype(np.uint8)
            return Image.fromarray(blended)
        
        else:
            raise ValueError(f"Unknown bg_mode: {bg_mode}")
        
    except Exception as e:
        print(f"  SAM3 error: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_single_image(image_path: str, prompt: str, output_dir: str):
    """Test segmentation on a single image with all background modes."""
    
    if not load_sam3():
        print("Failed to load SAM3")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    image = Image.open(image_path).convert("RGB")
    basename = os.path.splitext(os.path.basename(image_path))[0]
    
    print(f"\nTesting all background modes on: {image_path}")
    print(f"Original size: {image.size}")
    
    modes = [
        ("crop", "jpg", (0, 0, 0)),           # Original crop
        ("transparent", "png", (0, 0, 0)),    # Transparent background
        ("solid", "jpg", (0, 0, 0)),          # Black background
        ("solid", "jpg", (255, 255, 255)),    # White background
        ("mask_crop", "jpg", (0, 0, 0)),      # Masked crop with black bg
    ]
    
    for bg_mode, ext, bg_color in modes:
        suffix = f"{bg_mode}"
        if bg_mode == "solid":
            if bg_color == (0, 0, 0):
                suffix = "solid_black"
            elif bg_color == (255, 255, 255):
                suffix = "solid_white"
        
        result = segment_with_sam3(image, prompt, bg_mode=bg_mode, bg_color=bg_color)
        
        if result:
            output_path = os.path.join(output_dir, f"{basename}_{suffix}.{ext}")
            result.save(output_path)
            print(f"  ✓ {suffix}: {result.size} -> {output_path}")
        else:
            print(f"  ✗ {suffix}: Failed")
    
    print(f"\nAll outputs saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(description="SAM3 Segmentation with Background Removal")
    parser.add_argument("--test", type=str, help="Test on a single image")
    parser.add_argument("--bg-mode", type=str, default="mask_crop", 
                        choices=["crop", "transparent", "solid", "mask_crop"],
                        help="Background removal mode")
    parser.add_argument("--bg-color", type=str, default="black",
                        choices=["black", "white"],
                        help="Background color for solid/mask_crop modes")
    parser.add_argument("--prompt", type=str, default=PROMPT,
                        help="Text prompt for segmentation")
    parser.add_argument("--input", type=str, default=RAW_DIR,
                        help="Input directory")
    parser.add_argument("--output", type=str, default=OUTPUT_DIR,
                        help="Output directory")
    args = parser.parse_args()
    
    bg_color = (0, 0, 0) if args.bg_color == "black" else (255, 255, 255)
    
    # Test mode: single image with all modes
    if args.test:
        test_single_image(args.test, args.prompt, args.output)
        return
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # Load SAM3
    if not load_sam3():
        print("\nFailed to load SAM3. Exiting.")
        return
    
    ext = "png" if args.bg_mode == "transparent" else "jpg"
    
    print(f"\n{'='*60}")
    print(f"SAM3 Segmentation with Background Removal")
    print(f"{'='*60}")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Prompt: '{args.prompt}'")
    print(f"Mode: {args.bg_mode}")
    print(f"Background: {args.bg_color}")
    print(f"{'='*60}\n")
    
    total = 0
    success = 0
    
    # Process each label folder
    for label in os.listdir(args.input):
        label_path = os.path.join(args.input, label)
        if not os.path.isdir(label_path):
            continue
        
        # Create output label folder
        output_label_path = os.path.join(args.output, label)
        os.makedirs(output_label_path, exist_ok=True)
        
        # Get image files
        files = [f for f in os.listdir(label_path) 
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        
        print(f"Processing {label} ({len(files)} images)...")
        
        for fname in tqdm(files, desc=label):
            fpath = os.path.join(label_path, fname)
            total += 1
            
            try:
                image = Image.open(fpath).convert("RGB")
                
                # Segment with SAM3
                result = segment_with_sam3(image, args.prompt, bg_mode=args.bg_mode, bg_color=bg_color)
                
                # Change extension if needed
                output_fname = os.path.splitext(fname)[0] + f".{ext}"
                
                if result is not None:
                    success += 1
                    result.save(os.path.join(output_label_path, output_fname))
                else:
                    # Save original if segmentation fails
                    image.save(os.path.join(output_label_path, fname))
                    
            except Exception as e:
                print(f"Error processing {fname}: {e}")
    
    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"{'='*60}")
    print(f"Total images: {total}")
    if total > 0:
        print(f"Successfully processed: {success}/{total} ({success/total*100:.1f}%)")
    print(f"Output saved to: {args.output}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
