#!/usr/bin/env python3
"""
Test script for SAM3 cloud endpoint.
Run this once the endpoint is ready to verify it's working.
"""

import os
import sys
import requests
from PIL import Image
import io
from dotenv import load_dotenv

load_dotenv()

def test_endpoint(image_path: str, prompt: str = "mouse genitalia"):
    endpoint_url = os.environ.get("SAM3_ENDPOINT_URL")
    hf_token = os.environ.get("HF_TOKEN")
    
    if not endpoint_url:
        print("❌ SAM3_ENDPOINT_URL not set in environment")
        return False
    
    if not hf_token:
        print("❌ HF_TOKEN not set in environment")
        return False
    
    print(f"🔗 Endpoint: {endpoint_url}")
    print(f"📷 Image: {image_path}")
    print(f"💬 Prompt: {prompt}")
    print()
    
    # Load and prepare image
    try:
        image = Image.open(image_path).convert("RGB")
        print(f"✅ Loaded image: {image.size}")
    except Exception as e:
        print(f"❌ Failed to load image: {e}")
        return False
    
    # Convert to bytes
    img_buffer = io.BytesIO()
    image.save(img_buffer, format="JPEG", quality=95)
    img_bytes = img_buffer.getvalue()
    print(f"✅ Prepared {len(img_bytes)} bytes")
    
    # Make request
    print()
    print("🚀 Sending request to SAM3 endpoint...")
    
    try:
        response = requests.post(
            endpoint_url,
            headers={
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": list(img_bytes),  # Send as list of bytes
                "prompt": prompt,
                "bg_mode": "mask_crop",
                "bg_color": "black",
            },
            timeout=120,
        )
        
        print(f"📨 Response status: {response.status_code}")
        
        if response.status_code == 200:
            # Try to parse as image
            try:
                result_image = Image.open(io.BytesIO(response.content))
                output_path = "test_sam3_cloud_result.jpg"
                result_image.save(output_path)
                print(f"✅ SUCCESS! Saved result to {output_path}")
                print(f"   Result size: {result_image.size}")
                return True
            except Exception as e:
                # Maybe it's JSON?
                try:
                    data = response.json()
                    print(f"📋 JSON response: {data}")
                except:
                    print(f"📋 Raw response: {response.text[:500]}")
        else:
            print(f"❌ Error: {response.status_code}")
            try:
                print(f"   {response.json()}")
            except:
                print(f"   {response.text[:500]}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out (120s)")
        return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False


def check_endpoint_status():
    """Quick health check"""
    endpoint_url = os.environ.get("SAM3_ENDPOINT_URL")
    hf_token = os.environ.get("HF_TOKEN")
    
    if not endpoint_url or not hf_token:
        print("❌ Missing environment variables")
        return False
    
    try:
        response = requests.get(
            endpoint_url,
            headers={"Authorization": f"Bearer {hf_token}"},
            timeout=10,
        )
        
        if response.status_code == 200:
            print("✅ Endpoint is READY!")
            return True
        elif response.status_code == 503:
            print("⏳ Endpoint still initializing...")
            return False
        else:
            print(f"❓ Unexpected status: {response.status_code}")
            print(f"   {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("SAM3 Cloud Endpoint Test".center(60))
    print("=" * 60)
    print()
    
    # Check status first
    print("📡 Checking endpoint status...")
    if not check_endpoint_status():
        print()
        print("Endpoint not ready yet. Please wait for initialization to complete.")
        sys.exit(1)
    
    print()
    
    # Test with sample image
    test_images = [
        "../dataset_raw/ESTRUS/AI11_1_EST.jpg",
        "../dataset_raw/DIESTRUS/AI11_1_DIE.jpg",
    ]
    
    for img_path in test_images:
        if os.path.exists(img_path):
            print("-" * 60)
            test_endpoint(img_path)
            print()
            break
    else:
        print("No test images found. Please provide an image path as argument.")
        if len(sys.argv) > 1:
            test_endpoint(sys.argv[1])




