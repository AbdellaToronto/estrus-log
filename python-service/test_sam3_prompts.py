#!/usr/bin/env python3
"""Test multiple SAM3 prompts and create a comparison grid."""

import base64
import io
import os
import requests
from PIL import Image, ImageDraw, ImageFont

# Configuration
MODAL_ENDPOINT_URL = "https://abdellaalioncan--sam3-segmentation-segment-endpoint.modal.run"
OUTPUT_FILENAME = "sam3_trim_comparison.png"

# Test images from different stages
TEST_IMAGES = [
    "../dataset_raw/ESTRUS/AI11_1_EST.jpg",
    "../dataset_raw/DIESTRUS/AH09_1_DI.jpg",
    "../dataset_raw/METESTRUS/AH09_1_MET.jpg",
    "../dataset_raw/PROESTRUS/AH09_1_PRO.jpg",
]

# Test "tail" with different trim percentages
TRIM_PERCENTAGES = [0.0, 0.2, 0.3]  # 0%, 20%, 30% trim from top

def test_prompt(image_bytes: bytes, prompt: str, trim_top_percent: float = 0.0) -> Image.Image:
    """Test a single prompt and return the result image."""
    print(f"  Testing: '{prompt}' with trim_top={trim_top_percent*100:.0f}%...")
    
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    try:
        response = requests.post(
            MODAL_ENDPOINT_URL,
            json={
                "image": image_b64,
                "prompt": prompt,
                "bg_mode": "mask_crop",
                "bg_color": "black",
                "trim_top_percent": trim_top_percent,
            },
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        
        if response.status_code == 200:
            result = response.json()
            result_bytes = base64.b64decode(result["image"])
            return Image.open(io.BytesIO(result_bytes))
        else:
            print(f"    ❌ Error: {response.status_code}")
            return None
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return None


def create_comparison_grid(original: Image.Image, results: dict, output_path: str):
    """Create a grid comparing all results."""
    
    # Calculate grid dimensions
    num_results = len(results) + 1  # +1 for original
    cols = 3
    rows = (num_results + cols - 1) // cols
    
    # Size for each cell
    cell_width = 400
    cell_height = 400
    label_height = 40
    
    # Create canvas
    grid_width = cols * cell_width
    grid_height = rows * (cell_height + label_height)
    grid = Image.new("RGB", (grid_width, grid_height), (30, 30, 30))
    draw = ImageDraw.Draw(grid)
    
    # Try to get a font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
    except:
        font = ImageFont.load_default()
    
    # Add original image first
    all_items = [("ORIGINAL", original)] + list(results.items())
    
    for idx, (label, img) in enumerate(all_items):
        col = idx % cols
        row = idx // cols
        
        x = col * cell_width
        y = row * (cell_height + label_height)
        
        # Draw label
        draw.rectangle([x, y, x + cell_width, y + label_height], fill=(50, 50, 50))
        
        # Center the text
        bbox = draw.textbbox((0, 0), label, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = x + (cell_width - text_width) // 2
        
        color = (100, 255, 100) if img is not None else (255, 100, 100)
        draw.text((text_x, y + 8), label, fill=color, font=font)
        
        # Draw image
        if img is not None:
            # Resize to fit cell while maintaining aspect ratio
            img_copy = img.copy()
            img_copy.thumbnail((cell_width - 20, cell_height - 20), Image.Resampling.LANCZOS)
            
            # Center in cell
            img_x = x + (cell_width - img_copy.width) // 2
            img_y = y + label_height + (cell_height - img_copy.height) // 2
            
            # Handle RGBA images
            if img_copy.mode == "RGBA":
                # Create a background
                bg = Image.new("RGB", img_copy.size, (30, 30, 30))
                bg.paste(img_copy, mask=img_copy.split()[3])
                img_copy = bg
            
            grid.paste(img_copy, (img_x, img_y))
        else:
            # Draw "No mask found" text
            no_mask_text = "No mask found"
            bbox = draw.textbbox((0, 0), no_mask_text, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = x + (cell_width - text_width) // 2
            text_y = y + label_height + cell_height // 2
            draw.text((text_x, text_y), no_mask_text, fill=(150, 150, 150), font=font)
    
    grid.save(output_path)
    print(f"\n✅ Saved comparison grid to: {output_path}")
    return grid


def create_trim_comparison_grid(results: dict, output_path: str):
    """Create a grid comparing different trim percentages across multiple images.
    
    results: dict of {image_label: {trim_pct: cropped_image, "_original": original}}
    """
    
    image_labels = list(results.keys())
    trim_pcts = TRIM_PERCENTAGES
    
    rows = len(image_labels)
    cols = len(trim_pcts) + 1  # +1 for original
    
    # Size for each cell
    cell_width = 280
    cell_height = 350
    label_height = 30
    
    # Create canvas
    grid_width = cols * cell_width
    grid_height = rows * (cell_height + label_height)
    grid = Image.new("RGB", (grid_width, grid_height), (30, 30, 30))
    draw = ImageDraw.Draw(grid)
    
    # Try to get a font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except:
        font = ImageFont.load_default()
    
    for row_idx, label in enumerate(image_labels):
        y = row_idx * (cell_height + label_height)
        data = results[label]
        
        # Draw original
        x = 0
        draw.rectangle([x, y, x + cell_width, y + label_height], fill=(50, 50, 50))
        draw.text((x + 10, y + 6), f"{label}", fill=(150, 150, 150), font=font)
        
        original = data.get("_original")
        if original:
            img_copy = original.copy()
            img_copy.thumbnail((cell_width - 10, cell_height - 10), Image.Resampling.LANCZOS)
            img_x = x + (cell_width - img_copy.width) // 2
            img_y = y + label_height + (cell_height - img_copy.height) // 2
            grid.paste(img_copy, (img_x, img_y))
        
        # Draw each trim percentage result
        for col_idx, trim_pct in enumerate(trim_pcts):
            x = (col_idx + 1) * cell_width
            draw.rectangle([x, y, x + cell_width, y + label_height], fill=(50, 50, 50))
            
            cropped = data.get(trim_pct)
            color = (100, 255, 100) if cropped and cropped.size != original.size else (255, 100, 100)
            label_text = f"trim {trim_pct*100:.0f}%"
            draw.text((x + 10, y + 6), label_text, fill=color, font=font)
            
            if cropped:
                img_copy = cropped.copy()
                img_copy.thumbnail((cell_width - 10, cell_height - 10), Image.Resampling.LANCZOS)
                
                if img_copy.mode == "RGBA":
                    bg = Image.new("RGB", img_copy.size, (30, 30, 30))
                    bg.paste(img_copy, mask=img_copy.split()[3])
                    img_copy = bg
                
                img_x = x + (cell_width - img_copy.width) // 2
                img_y = y + label_height + (cell_height - img_copy.height) // 2
                grid.paste(img_copy, (img_x, img_y))
    
    grid.save(output_path)
    print(f"\n✅ Saved comparison grid to: {output_path}")


def main():
    print("=" * 60)
    print("SAM3 'tail' with Trim Top Comparison")
    print("=" * 60)
    
    results = {}
    
    for image_path in TEST_IMAGES:
        label = os.path.basename(os.path.dirname(image_path))  # Get stage name
        print(f"\n📷 Testing: {label}")
        
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        original = Image.open(io.BytesIO(image_bytes))
        
        results[label] = {"_original": original}
        
        for trim_pct in TRIM_PERCENTAGES:
            cropped = test_prompt(image_bytes, "tail", trim_pct)
            results[label][trim_pct] = cropped
            
            if cropped and cropped.size != original.size:
                print(f"    ✅ trim {trim_pct*100:.0f}%: {cropped.size}")
            else:
                print(f"    ❌ trim {trim_pct*100:.0f}%: No crop")
    
    # Create comparison grid
    print("\n📊 Creating comparison grid...")
    create_trim_comparison_grid(results, OUTPUT_FILENAME)
    
    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for label, data in results.items():
        original = data["_original"]
        print(f"  {label}:")
        for trim_pct in TRIM_PERCENTAGES:
            crop = data.get(trim_pct)
            if crop and crop.size != original.size:
                print(f"    trim {trim_pct*100:.0f}%: {crop.size[0]}x{crop.size[1]}")
            else:
                print(f"    trim {trim_pct*100:.0f}%: No crop")


if __name__ == "__main__":
    main()



