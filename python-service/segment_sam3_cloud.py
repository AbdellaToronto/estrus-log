"""
SAM3 Cloud Segmentation Script with Background Removal

Uses your deployed SAM3 Inference Endpoint on Hugging Face.
Much faster than local processing - runs on GPU!

Usage:
    # Test single image
    python segment_sam3_cloud.py --test ../dataset_raw/ESTRUS/AI11_1_EST.jpg
    
    # Process all images
    python segment_sam3_cloud.py --input ../dataset_raw --output ../dataset_sam3_cropped
"""

import os
import io
import base64
from PIL import Image
import numpy as np
from tqdm import tqdm
from dotenv import load_dotenv
import requests
import argparse

load_dotenv()

# Directories
RAW_DIR = "../dataset_raw"
OUTPUT_DIR = "../dataset_sam3_cropped"
PROMPT = "mouse genitalia"

# Your Inference Endpoint URL - UPDATE THIS after deploying!
# It will look like: https://xxxxxxxxxx.us-east-1.aws.endpoints.huggingface.cloud
ENDPOINT_URL = os.environ.get("SAM3_ENDPOINT_URL", "")
HF_TOKEN = os.environ.get("HF_TOKEN")


def query_endpoint(image: Image.Image, prompt: str) -> dict:
    """Query your SAM3 Inference Endpoint."""
    if not ENDPOINT_URL:
        raise ValueError("SAM3_ENDPOINT_URL not set! Add it to .env.local after deploying your endpoint.")
    
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Convert image to base64
    img_buffer = io.BytesIO()
    image.save(img_buffer, format="JPEG", quality=85)
    img_b64 = base64.b64encode(img_buffer.getvalue()).decode("utf-8")
    
    # Send request
    response = requests.post(
        ENDPOINT_URL,
        headers=headers,
        json={
            "inputs": img_b64,
            "prompt": prompt,
            "threshold": 0.1,
            "return_mask": True
        },
        timeout=120
    )
    
    if response.status_code != 200:
        raise Exception(f"API error {response.status_code}: {response.text}")
    
    return response.json()


def segment_with_endpoint(image: Image.Image, prompt: str, bg_color: tuple = (0, 0, 0)) -> Image.Image:
    """
    Segment image using your SAM3 endpoint with background removal.
    Returns cropped image with background removed, or None if fails.
    """
    try:
        results = query_endpoint(image, prompt)
        
        if not results or len(results) == 0:
            print("  No segments returned")
            return None
        
        if "error" in results[0]:
            print(f"  Endpoint error: {results[0]['error']}")
            return None
        
        # Get the best result (highest score)
        best = results[0]
        
        # Decode the mask
        mask_b64 = best.get("mask")
        if not mask_b64:
            # Use bounding box only
            box = best["box"]
            return image.crop((box["xmin"], box["ymin"], box["xmax"], box["ymax"]))
        
        mask_bytes = base64.b64decode(mask_b64)
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")
        
        # Ensure mask matches image size
        if mask_img.size != image.size:
            mask_img = mask_img.resize(image.size, Image.BILINEAR)
        
        mask_np = np.array(mask_img) / 255.0
        
        # Get bounding box from response or calculate from mask
        box = best.get("box")
        if box:
            xmin, ymin = box["xmin"], box["ymin"]
            xmax, ymax = box["xmax"], box["ymax"]
        else:
            binary_mask = mask_np > 0.5
            rows = np.any(binary_mask, axis=1)
            cols = np.any(binary_mask, axis=0)
            if not rows.any() or not cols.any():
                return None
            ymin, ymax = np.where(rows)[0][[0, -1]]
            xmin, xmax = np.where(cols)[0][[0, -1]]
        
        # Add padding
        w, h = image.size
        padding = 30
        xmin = max(0, xmin - padding)
        ymin = max(0, ymin - padding)
        xmax = min(w, xmax + padding)
        ymax = min(h, ymax + padding)
        
        # Apply mask with background removal
        img_np = np.array(image)
        cropped_img = img_np[ymin:ymax, xmin:xmax]
        cropped_mask = mask_np[ymin:ymax, xmin:xmax]
        
        # Blend with background color
        bg = np.full_like(cropped_img, bg_color)
        mask_3d = np.stack([cropped_mask] * 3, axis=-1)
        blended = (cropped_img * mask_3d + bg * (1 - mask_3d)).astype(np.uint8)
        
        return Image.fromarray(blended)
        
    except Exception as e:
        print(f"  Error: {e}")
        return None


def test_single_image(image_path: str, prompt: str, output_dir: str):
    """Test on a single image."""
    if not ENDPOINT_URL:
        print("="*60)
        print("ERROR: SAM3_ENDPOINT_URL not set!")
        print("="*60)
        print("\nAfter deploying your endpoint, add to .env.local:")
        print("SAM3_ENDPOINT_URL=https://your-endpoint-url.endpoints.huggingface.cloud")
        print("\nYou can find the URL in the Hugging Face Inference Endpoints dashboard.")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    image = Image.open(image_path).convert("RGB")
    basename = os.path.splitext(os.path.basename(image_path))[0]
    
    print(f"Testing SAM3 Endpoint on: {image_path}")
    print(f"Endpoint: {ENDPOINT_URL}")
    print(f"Original size: {image.size}")
    
    result = segment_with_endpoint(image, prompt, bg_color=(0, 0, 0))
    
    if result:
        output_path = os.path.join(output_dir, f"{basename}_sam3_cloud.jpg")
        result.save(output_path)
        print(f"✓ Success! Saved to {output_path}")
        print(f"  Cropped size: {result.size}")
    else:
        print("✗ Segmentation failed")


def main():
    parser = argparse.ArgumentParser(description="SAM3 Cloud Segmentation with Background Removal")
    parser.add_argument("--test", type=str, help="Test on a single image")
    parser.add_argument("--bg-color", type=str, default="black",
                        choices=["black", "white"],
                        help="Background color")
    parser.add_argument("--prompt", type=str, default=PROMPT,
                        help="Text prompt for segmentation")
    parser.add_argument("--input", type=str, default=RAW_DIR,
                        help="Input directory")
    parser.add_argument("--output", type=str, default=OUTPUT_DIR,
                        help="Output directory")
    args = parser.parse_args()
    
    if not HF_TOKEN:
        print("Error: HF_TOKEN not set. Please set it in .env.local")
        return
    
    bg_color = (0, 0, 0) if args.bg_color == "black" else (255, 255, 255)
    
    # Test mode
    if args.test:
        test_single_image(args.test, args.prompt, args.output)
        return
    
    # Check endpoint URL
    if not ENDPOINT_URL:
        print("="*60)
        print("ERROR: SAM3_ENDPOINT_URL not set!")
        print("="*60)
        print("\nAfter deploying your endpoint, add to .env.local:")
        print("SAM3_ENDPOINT_URL=https://your-endpoint-url.endpoints.huggingface.cloud")
        return
    
    # Full processing
    os.makedirs(args.output, exist_ok=True)
    
    print(f"\n{'='*60}")
    print(f"SAM3 CLOUD Segmentation with Background Removal")
    print(f"{'='*60}")
    print(f"Endpoint: {ENDPOINT_URL}")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Prompt: '{args.prompt}'")
    print(f"Background: {args.bg_color}")
    print(f"{'='*60}\n")
    
    total = 0
    success = 0
    
    # Process each label folder
    for label in sorted(os.listdir(args.input)):
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
                
                # Segment with endpoint
                result = segment_with_endpoint(image, args.prompt, bg_color=bg_color)
                
                if result is not None:
                    success += 1
                    result.save(os.path.join(output_label_path, fname))
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
