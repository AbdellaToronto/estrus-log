"""
EVF-SAM2 wrapper for text-prompted segmentation.

This module wraps the EVF-SAM2 model for easy integration with our BioCLIP service.
EVF-SAM2 allows text-prompted segmentation (e.g., "mouse genitalia").

Based on: https://github.com/hustvl/EVF-SAM
"""

import os
import sys
import numpy as np
import torch
import torch.nn.functional as F
from torchvision import transforms
from torchvision.transforms.functional import InterpolationMode
from PIL import Image
from typing import Optional

# Add EVF-SAM repo to path
EVF_SAM_PATH = os.path.join(os.path.dirname(__file__), "evf_sam_repo")
if EVF_SAM_PATH not in sys.path:
    sys.path.insert(0, EVF_SAM_PATH)

# Global model instances
_evf_model = None
_evf_tokenizer = None
_evf_device = None
_evf_dtype = None


def sam_preprocess(
    x: np.ndarray,
    pixel_mean=torch.Tensor([123.675, 116.28, 103.53]).view(-1, 1, 1),
    pixel_std=torch.Tensor([58.395, 57.12, 57.375]).view(-1, 1, 1),
    img_size=1024,
) -> torch.Tensor:
    """Preprocess image for SAM2 (resize, normalize, no padding for sam2)."""
    x = torch.from_numpy(x).permute(2, 0, 1).contiguous().float()
    x = F.interpolate(x.unsqueeze(0), (img_size, img_size), mode="bilinear", align_corners=False).squeeze(0)
    x = (x - pixel_mean) / pixel_std
    return x, None  # resize_shape is None for sam2


def beit3_preprocess(x: np.ndarray, img_size=224) -> torch.Tensor:
    """Preprocess image for BEIT-3 vision encoder."""
    beit_preprocess = transforms.Compose([
        transforms.ToTensor(),
        transforms.Resize((img_size, img_size), interpolation=InterpolationMode.BICUBIC, antialias=None),
        transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))
    ])
    return beit_preprocess(x)


def load_evf_sam2(precision: str = "fp32"):
    """
    Load EVF-SAM2 model.
    
    Args:
        precision: "fp32", "fp16", or "bf16"
    """
    global _evf_model, _evf_tokenizer, _evf_device, _evf_dtype
    
    if _evf_model is not None:
        return _evf_model, _evf_tokenizer
    
    from transformers import AutoTokenizer
    from model.evf_sam2 import EvfSam2Model
    
    print("Loading EVF-SAM2 model...")
    
    # Determine device and dtype
    _evf_device = "cuda" if torch.cuda.is_available() else "cpu"
    
    if precision == "bf16":
        _evf_dtype = torch.bfloat16
    elif precision == "fp16":
        _evf_dtype = torch.half
    else:
        _evf_dtype = torch.float32
    
    # Load tokenizer
    _evf_tokenizer = AutoTokenizer.from_pretrained(
        "YxZhang/evf-sam2",
        padding_side="right",
        use_fast=False,
    )
    
    # Load model
    _evf_model = EvfSam2Model.from_pretrained(
        "YxZhang/evf-sam2",
        low_cpu_mem_usage=True,
        torch_dtype=_evf_dtype
    )
    
    if _evf_device == "cuda":
        _evf_model = _evf_model.cuda()
    
    _evf_model.eval()
    
    print(f"EVF-SAM2 loaded on {_evf_device} with {precision} precision.")
    
    return _evf_model, _evf_tokenizer


def segment_with_evf_sam2(image: Image.Image, prompt: str) -> Optional[Image.Image]:
    """
    Segment an image using EVF-SAM2 with a text prompt.
    
    Args:
        image: PIL Image
        prompt: Text description of what to segment (e.g., "mouse genitalia")
    
    Returns:
        Cropped PIL Image or None if segmentation fails
    """
    global _evf_model, _evf_tokenizer, _evf_device, _evf_dtype
    
    if _evf_model is None:
        load_evf_sam2()
    
    try:
        # Convert PIL to numpy
        image_np = np.array(image)
        original_size = image_np.shape[:2]  # (H, W)
        
        # Preprocess for BEIT-3 (vision-language encoder)
        image_beit = beit3_preprocess(image_np, img_size=224)
        image_beit = image_beit.to(dtype=_evf_dtype, device=_evf_device)
        
        # Preprocess for SAM2
        image_sam, resize_shape = sam_preprocess(image_np)
        image_sam = image_sam.to(dtype=_evf_dtype, device=_evf_device)
        
        # Tokenize prompt
        input_ids = _evf_tokenizer(prompt, return_tensors="pt")["input_ids"].to(device=_evf_device)
        
        # Run inference
        with torch.no_grad():
            pred_mask = _evf_model.inference(
                image_sam.unsqueeze(0),
                image_beit.unsqueeze(0),
                input_ids,
                resize_list=[resize_shape],
                original_size_list=[original_size],
            )
        
        # Convert mask to numpy
        pred_mask = pred_mask.detach().cpu().numpy()[0]
        pred_mask = pred_mask > 0  # Binary mask
        
        # Find bounding box from mask
        rows = np.any(pred_mask, axis=1)
        cols = np.any(pred_mask, axis=0)
        
        if rows.any() and cols.any():
            ymin, ymax = np.where(rows)[0][[0, -1]]
            xmin, xmax = np.where(cols)[0][[0, -1]]
            
            # Add padding
            h, w = original_size
            padding = 20
            xmin = max(0, xmin - padding)
            ymin = max(0, ymin - padding)
            xmax = min(w, xmax + padding)
            ymax = min(h, ymax + padding)
            
            # Crop
            cropped = image.crop((xmin, ymin, xmax, ymax))
            return cropped
        
        return None
        
    except Exception as e:
        print(f"EVF-SAM2 segmentation error: {e}")
        import traceback
        traceback.print_exc()
        return None


# Test function
if __name__ == "__main__":
    # Quick test
    test_img_path = "../dataset_raw/ESTRUS/AH09_1_EST.jpg"
    if os.path.exists(test_img_path):
        img = Image.open(test_img_path).convert("RGB")
        print(f"Original size: {img.size}")
        
        cropped = segment_with_evf_sam2(img, "mouse genitalia")
        if cropped:
            print(f"Cropped size: {cropped.size}")
            cropped.save("test_evf_crop.jpg")
            print("SUCCESS! Saved to test_evf_crop.jpg")
        else:
            print("No segmentation found")
    else:
        print(f"Test image not found: {test_img_path}")

