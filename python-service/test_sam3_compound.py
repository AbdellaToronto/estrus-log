#!/usr/bin/env python3
"""Test compound prompts: stage1 (body isolation) + stage2 (genital area)."""

import base64
import io
import os
import requests
from PIL import Image, ImageDraw, ImageFont

# Configuration
MODAL_ENDPOINT_URL = "https://abdellaalioncan--sam3-segmentation-segment-endpoint.modal.run"
OUTPUT_FILENAME = "sam3_compound_comparison.png"

# Test images from different stages
TEST_IMAGES = [
    "../dataset_raw/ESTRUS/AI11_1_EST.jpg",
    "../dataset_raw/DIESTRUS/AH09_1_DI.jpg",
    "../dataset_raw/METESTRUS/AH09_1_MET.jpg",
    "../dataset_raw/PROESTRUS/AH09_1_PRO.jpg",
]

# Stage 1: Mask crop to just the mouse body (removes hand/glove/background)
STAGE1_PROMPT = "mouse body"

# Stage 2 prompts: 6 terms, each tested as "naive" and "mouse X" prefix
# Format: (naive_prompt, prefixed_prompt)
STAGE2_PROMPTS = [
    ("vulva", "mouse vulva"),
    ("genitals", "mouse genitals"),
    ("pink skin", "mouse pink skin"),
    ("tail", "mouse tail"),
    ("rear", "mouse rear"),
    ("bottom", "mouse bottom"),
]


def test_compound(image_bytes: bytes, stage1: str, stage2: str) -> Image.Image:
    """Test a compound prompt and return the result image."""
    label = f"{'body' if stage1 else 'direct'}→{stage2}"
    print(f"    Testing: {label}...", end=" ")
    
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    try:
        response = requests.post(
            MODAL_ENDPOINT_URL,
            json={
                "image": image_b64,
                "prompt": stage2,
                "stage1_prompt": stage1,
                "bg_mode": "mask_crop",
                "bg_color": "black",
            },
            headers={"Content-Type": "application/json"},
            timeout=180,
        )
        
        if response.status_code == 200:
            result = response.json()
            result_bytes = base64.b64decode(result["image"])
            return Image.open(io.BytesIO(result_bytes))
        else:
            print(f"      ❌ Error: {response.status_code}")
            return None
    except Exception as e:
        print(f"      ❌ Exception: {e}")
        return None


def create_grid(results: dict, output_path: str):
    """Create a comparison grid."""
    image_labels = list(results.keys())
    
    # Order prompts: naive then prefixed, grouped by base term
    prompt_order = []
    for naive, prefixed in STAGE2_PROMPTS:
        prompt_order.append(naive)
        prompt_order.append(prefixed)
    
    rows = len(image_labels)
    cols = len(prompt_order) + 1  # +1 for original
    
    cell_width = 160
    cell_height = 220
    label_height = 40
    
    grid_width = cols * cell_width
    grid_height = rows * (cell_height + label_height)
    grid = Image.new("RGB", (grid_width, grid_height), (30, 30, 30))
    draw = ImageDraw.Draw(grid)
    
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
    except:
        font = ImageFont.load_default()
    
    for row_idx, label in enumerate(image_labels):
        y = row_idx * (cell_height + label_height)
        data = results[label]
        
        # Draw original
        x = 0
        draw.rectangle([x, y, x + cell_width, y + label_height], fill=(50, 50, 50))
        draw.text((x + 5, y + 12), label, fill=(150, 150, 150), font=font)
        
        original = data.get("_original")
        if original:
            img_copy = original.copy()
            img_copy.thumbnail((cell_width - 8, cell_height - 8), Image.Resampling.LANCZOS)
            img_x = x + (cell_width - img_copy.width) // 2
            img_y = y + label_height + (cell_height - img_copy.height) // 2
            grid.paste(img_copy, (img_x, img_y))
        
        # Draw each result
        for col_idx, key in enumerate(prompt_order):
            x = (col_idx + 1) * cell_width
            draw.rectangle([x, y, x + cell_width, y + label_height], fill=(50, 50, 50))
            
            cropped = data.get(key)
            # Check if it's a good crop (smaller than original but not too small)
            is_good = False
            if cropped and original:
                crop_area = cropped.size[0] * cropped.size[1]
                orig_area = original.size[0] * original.size[1]
                ratio = crop_area / orig_area
                is_good = 0.005 < ratio < 0.25
            
            color = (100, 255, 100) if is_good else (255, 100, 100)
            draw.text((x + 3, y + 12), key, fill=color, font=font)
            
            if cropped:
                img_copy = cropped.copy()
                img_copy.thumbnail((cell_width - 8, cell_height - 8), Image.Resampling.LANCZOS)
                
                if img_copy.mode == "RGBA":
                    bg = Image.new("RGB", img_copy.size, (30, 30, 30))
                    bg.paste(img_copy, mask=img_copy.split()[3])
                    img_copy = bg
                
                img_x = x + (cell_width - img_copy.width) // 2
                img_y = y + label_height + (cell_height - img_copy.height) // 2
                grid.paste(img_copy, (img_x, img_y))
    
    grid.save(output_path)
    print(f"\n✅ Saved grid to: {output_path}")


def main():
    print("=" * 70)
    print("SAM3 Two-Stage Experiment")
    print(f"Stage 1: '{STAGE1_PROMPT}' MASK CROP (black out non-body)")
    print("Stage 2: Naive vs 'mouse X' prefixed prompts")
    print("=" * 70)
    
    results = {}
    
    for image_path in TEST_IMAGES:
        label = os.path.basename(os.path.dirname(image_path))
        print(f"\n📷 {label}")
        
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        original = Image.open(io.BytesIO(image_bytes))
        
        results[label] = {"_original": original}
        
        for naive, prefixed in STAGE2_PROMPTS:
            # Test naive prompt (after body mask crop)
            key_naive = naive
            cropped = test_compound(image_bytes, STAGE1_PROMPT, naive)
            results[label][key_naive] = cropped
            if cropped and cropped.size != original.size:
                print(f"      ✅ {key_naive}: {cropped.size}")
            else:
                print(f"      ❌ {key_naive}: No crop")
            
            # Test prefixed prompt (after body mask crop)
            key_prefixed = prefixed
            cropped = test_compound(image_bytes, STAGE1_PROMPT, prefixed)
            results[label][key_prefixed] = cropped
            if cropped and cropped.size != original.size:
                print(f"      ✅ {key_prefixed}: {cropped.size}")
            else:
                print(f"      ❌ {key_prefixed}: No crop")
    
    print("\n📊 Creating comparison grid...")
    create_grid(results, OUTPUT_FILENAME)
    
    # Summary
    print("\n" + "=" * 70)
    print("BEST RESULTS PER IMAGE")
    print("=" * 70)
    for label, data in results.items():
        original = data["_original"]
        orig_area = original.size[0] * original.size[1]
        
        best_key = None
        best_ratio = 1.0
        
        for key, crop in data.items():
            if key == "_original":
                continue
            if crop and crop.size != original.size:
                crop_area = crop.size[0] * crop.size[1]
                ratio = crop_area / orig_area
                # We want a crop that's reasonably small (between 0.5% and 20% of original)
                if 0.005 < ratio < 0.20 and ratio < best_ratio:
                    best_ratio = ratio
                    best_key = key
        
        if best_key:
            crop = data[best_key]
            print(f"  {label}: '{best_key}' → {crop.size} ({best_ratio*100:.1f}%)")
        else:
            print(f"  {label}: No ideal crop found")


if __name__ == "__main__":
    main()

