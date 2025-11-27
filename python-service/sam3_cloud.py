"""
SAM3 Cloud Segmentation Client

This module provides a client for calling the SAM3 Hugging Face Inference Endpoint
for image segmentation with background removal.
"""

import os
import io
import base64
from typing import Optional, Tuple
from PIL import Image
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
SAM3_ENDPOINT_URL = os.environ.get("SAM3_ENDPOINT_URL")
HF_TOKEN = os.environ.get("HF_TOKEN")


def is_endpoint_ready() -> bool:
    """Check if the SAM3 endpoint is ready to accept requests."""
    if not SAM3_ENDPOINT_URL or not HF_TOKEN:
        return False
    
    try:
        response = requests.get(
            SAM3_ENDPOINT_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            timeout=10,
        )
        return response.status_code == 200
    except Exception:
        return False


def segment_with_sam3_cloud(
    image: Image.Image,
    prompt: str = "mouse genitalia",
    bg_mode: str = "mask_crop",
    bg_color: str = "black",
    timeout: int = 120,
) -> Tuple[Optional[Image.Image], Optional[str]]:
    """
    Segment an image using the SAM3 cloud endpoint.
    
    Args:
        image: PIL Image to segment
        prompt: Text prompt for segmentation
        bg_mode: Background mode - "crop", "transparent", "solid", "mask_crop"
        bg_color: Background color for solid mode
        timeout: Request timeout in seconds
    
    Returns:
        Tuple of (segmented_image, error_message)
        If successful, error_message is None
        If failed, segmented_image is None
    """
    if not SAM3_ENDPOINT_URL:
        return None, "SAM3_ENDPOINT_URL not configured"
    
    if not HF_TOKEN:
        return None, "HF_TOKEN not configured"
    
    try:
        # Convert image to bytes
        img_buffer = io.BytesIO()
        image.save(img_buffer, format="JPEG", quality=95)
        img_bytes = img_buffer.getvalue()
        
        # Encode as base64 for JSON transport
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")
        
        # Make request to endpoint
        response = requests.post(
            SAM3_ENDPOINT_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": img_base64,
                "prompt": prompt,
                "bg_mode": bg_mode,
                "bg_color": bg_color,
            },
            timeout=timeout,
        )
        
        if response.status_code == 200:
            # Try to parse response as image
            try:
                result_image = Image.open(io.BytesIO(response.content))
                return result_image, None
            except Exception as e:
                # Maybe it's JSON with base64 image?
                try:
                    data = response.json()
                    if "image" in data:
                        img_data = base64.b64decode(data["image"])
                        result_image = Image.open(io.BytesIO(img_data))
                        return result_image, None
                    else:
                        return None, f"Unexpected response format: {data}"
                except Exception:
                    return None, f"Failed to parse response: {str(e)}"
        
        elif response.status_code == 503:
            return None, "SAM3 endpoint is still initializing"
        
        elif response.status_code == 404:
            return None, "No segmentation mask found for the given prompt"
        
        else:
            try:
                error_data = response.json()
                return None, f"SAM3 error ({response.status_code}): {error_data.get('error', 'Unknown error')}"
            except Exception:
                return None, f"SAM3 error ({response.status_code}): {response.text[:200]}"
    
    except requests.exceptions.Timeout:
        return None, f"SAM3 request timed out after {timeout}s"
    
    except requests.exceptions.ConnectionError:
        return None, "Failed to connect to SAM3 endpoint"
    
    except Exception as e:
        return None, f"SAM3 request failed: {str(e)}"


def segment_and_save(
    image_path: str,
    output_path: str,
    prompt: str = "mouse genitalia",
    bg_mode: str = "mask_crop",
    bg_color: str = "black",
) -> Tuple[bool, Optional[str]]:
    """
    Convenience function to segment an image file and save the result.
    
    Args:
        image_path: Path to input image
        output_path: Path to save segmented image
        prompt: Text prompt for segmentation
        bg_mode: Background mode
        bg_color: Background color for solid mode
    
    Returns:
        Tuple of (success, error_message)
    """
    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        return False, f"Failed to load image: {str(e)}"
    
    result, error = segment_with_sam3_cloud(image, prompt, bg_mode, bg_color)
    
    if result is None:
        return False, error
    
    try:
        # Determine format from output path
        if output_path.lower().endswith(".png"):
            result.save(output_path, format="PNG")
        else:
            result.save(output_path, format="JPEG", quality=95)
        return True, None
    except Exception as e:
        return False, f"Failed to save result: {str(e)}"


if __name__ == "__main__":
    # Quick test
    print("SAM3 Cloud Client")
    print("=" * 40)
    print(f"Endpoint: {SAM3_ENDPOINT_URL}")
    print(f"Token configured: {'Yes' if HF_TOKEN else 'No'}")
    print()
    
    if is_endpoint_ready():
        print("✅ Endpoint is READY!")
    else:
        print("⏳ Endpoint not ready or not configured")




