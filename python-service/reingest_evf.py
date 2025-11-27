"""
Re-segment training data with EVF-SAM2 and re-ingest to Supabase.

This ensures the reference library uses the same segmentation as inference.
"""

import os
from PIL import Image
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client
import torch
import numpy as np
import open_clip

from evf_sam_wrapper import segment_with_evf_sam2, load_evf_sam2

load_dotenv()

TRAIN_RAW_DIR = "../dataset_raw"  # Use raw images
TRAIN_SPLIT_DIR = "../dataset_split_cropped/train"  # Get file list from here
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials not found")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# BioCLIP model
bioclip_model = None
bioclip_preprocess = None


def load_bioclip():
    global bioclip_model, bioclip_preprocess
    print("Loading BioCLIP model...")
    model_name = 'hf-hub:imageomics/bioclip'
    bioclip_model, _, bioclip_preprocess = open_clip.create_model_and_transforms(model_name)
    bioclip_model.eval()
    print("BioCLIP loaded.")


def get_embedding(image: Image.Image) -> list:
    image_tensor = bioclip_preprocess(image).unsqueeze(0)
    with torch.no_grad():
        outputs = bioclip_model.encode_image(image_tensor)
        features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
        return features.squeeze().tolist()


def main():
    # Load models
    load_evf_sam2(precision="fp32")
    load_bioclip()
    
    print("\n" + "="*60)
    print("Re-ingesting training data with EVF-SAM2 segmentation")
    print("="*60 + "\n")
    
    # Clear existing reference images
    print("Clearing existing reference images...")
    try:
        supabase.table("reference_images").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("Cleared.")
    except Exception as e:
        print(f"Clear warning: {e}")
    
    ingested = 0
    evf_success = 0
    
    for label in os.listdir(TRAIN_SPLIT_DIR):
        label_dir = os.path.join(TRAIN_SPLIT_DIR, label)
        if not os.path.isdir(label_dir):
            continue
        
        files = [f for f in os.listdir(label_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        print(f"\nProcessing {label} ({len(files)} images)...")
        
        for fname in tqdm(files, desc=label):
            # Find RAW image
            raw_path = os.path.join(TRAIN_RAW_DIR, label, fname)
            if not os.path.exists(raw_path):
                continue
            
            try:
                image = Image.open(raw_path).convert("RGB")
            except Exception as e:
                print(f"Error opening {raw_path}: {e}")
                continue
            
            # Crop with EVF-SAM2
            cropped = segment_with_evf_sam2(image, "mouse genitalia")
            if cropped:
                evf_success += 1
                image = cropped
            
            # Generate embedding
            embedding = get_embedding(image)
            
            # Upsert to Supabase
            try:
                supabase.table("reference_images").insert({
                    "image_path": fname,
                    "label": label.upper(),
                    "embedding": embedding,
                    "metadata": {"segmentation": "evf-sam2"}
                }).execute()
                ingested += 1
            except Exception as e:
                print(f"Insert error for {fname}: {e}")
    
    print("\n" + "="*60)
    print("INGEST COMPLETE")
    print("="*60)
    print(f"Total ingested: {ingested}")
    if ingested > 0:
        print(f"EVF-SAM2 crop success: {evf_success}/{ingested} ({evf_success/ingested*100:.1f}%)")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()

