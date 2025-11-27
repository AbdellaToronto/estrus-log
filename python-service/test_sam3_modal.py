#!/usr/bin/env python3
"""
Quick test script for SAM3 Modal endpoint.
"""

import base64
import requests
import sys
from pathlib import Path

ENDPOINT_URL = "https://abdellaalioncan--sam3-segmentation-segment-endpoint.modal.run"

def test_sam3_modal(image_path: str, prompt: str = "pink skin"):
    """Test the SAM3 Modal endpoint."""
    
    print("=" * 60)
    print("SAM3 Modal Endpoint Test")
    print("=" * 60)
    print(f"📷 Image: {image_path}")
    print(f"💬 Prompt: {prompt}")
    print(f"🔗 Endpoint: {ENDPOINT_URL}")
    print()
    
    # Load image
    path = Path(image_path)
    if not path.exists():
        print(f"❌ Image not found: {image_path}")
        return False
    
    with open(path, "rb") as f:
        image_bytes = f.read()
    
    print(f"✅ Loaded image: {len(image_bytes)} bytes")
    
    # Encode as base64
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    # Make request
    print()
    print("🚀 Sending request to SAM3 Modal endpoint...")
    print("   (First request may take ~30s for cold start)")
    
    try:
        response = requests.post(
            ENDPOINT_URL,
            json={
                "image": image_b64,
                "prompt": prompt,
                "bg_mode": "mask_crop",
                "bg_color": "black",
            },
            timeout=300,  # 5 minutes for cold start
        )
        
        print(f"📨 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if "error" in data:
                print(f"❌ Error: {data['error']}")
                return False
            
            # Decode result image
            result_b64 = data.get("image")
            img_format = data.get("format", "jpeg")
            
            if result_b64:
                result_bytes = base64.b64decode(result_b64)
                output_path = f"test_sam3_modal_result.{img_format}"
                
                with open(output_path, "wb") as f:
                    f.write(result_bytes)
                
                print()
                print("✅ SUCCESS!")
                print(f"   Saved result to: {output_path}")
                print(f"   Result size: {len(result_bytes)} bytes")
                return True
            else:
                print("❌ No image in response")
                print(f"   Response: {data}")
                return False
        else:
            print(f"❌ Request failed: {response.status_code}")
            try:
                print(f"   {response.json()}")
            except:
                print(f"   {response.text[:500]}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out (120s)")
        print("   The endpoint might still be cold-starting.")
        print("   Try again in a minute!")
        return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False


if __name__ == "__main__":
    # Default test images
    test_images = [
        "../dataset_raw/ESTRUS/AI11_1_EST.jpg",
        "../dataset_raw/DIESTRUS/AI12_1_DI.jpg",
    ]
    
    # Use command line arg if provided
    if len(sys.argv) > 1:
        test_images = [sys.argv[1]]
    
    # Find first existing image
    for img_path in test_images:
        if Path(img_path).exists():
            success = test_sam3_modal(img_path)
            sys.exit(0 if success else 1)
    
    print("❌ No test images found!")
    print("   Usage: python test_sam3_modal.py [image_path]")
    sys.exit(1)

