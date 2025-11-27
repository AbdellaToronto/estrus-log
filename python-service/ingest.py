import os
import argparse
import asyncio
from typing import List, Optional
from supabase import create_client, Client
from transformers import AutoProcessor, AutoModel
from PIL import Image
import torch
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()

def get_embedding(model, processor, image_path: str) -> Optional[List[float]]:
    try:
        image = Image.open(image_path).convert("RGB")
        # Processor in open_clip is a torchvision transform
        image_tensor = processor(image).unsqueeze(0) 
        with torch.no_grad():
            outputs = model.encode_image(image_tensor)
            features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
            embedding = features.squeeze().tolist()
        return embedding
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return None

async def main():
    parser = argparse.ArgumentParser(description="Ingest reference images into Supabase Vector Store")
    parser.add_argument("--dir", required=True, help="Path to dataset directory containing class subfolders (e.g. ./dataset/Estrus)")
    parser.add_argument("--url", required=False, help="Supabase URL")
    parser.add_argument("--key", required=False, help="Supabase Service Key")
    parser.add_argument("--clear", action="store_true", help="Clear existing reference images before ingesting")
    args = parser.parse_args()

    # Load credentials
    url = args.url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = args.key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials required. Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars or pass arguments.")
        return

    print(f"Connecting to Supabase at {url}...")
    supabase: Client = create_client(url, key)

    if args.clear:
        print("Clearing existing reference images...")
        # Delete all rows. 
        # Note: Supabase-py delete requires a filter. neq id 0 is a hack for 'all' if using int ids, 
        # but for UUIDs we can try a different approach or just delete one by one if needed, 
        # but standard delete with filter is safer.
        # 'id' is not null.
        supabase.table("reference_images").delete().neq("label", "INVALID_LABEL_PLACEHOLDER").execute()

    # Load Model
    print("Loading BioCLIP model (this may take a moment)...")
    # BioCLIP models are often loaded via open_clip
    try:
        import open_clip
        model_name = 'hf-hub:imageomics/bioclip'
        model, _, preprocess = open_clip.create_model_and_transforms(model_name)
        tokenizer = open_clip.get_tokenizer(model_name)
        model.eval()
        processor = preprocess # Use the transform as the processor
    except ImportError:
        print("open_clip_torch not found. Please install it: pip install open_clip_torch")
        return
    except Exception as e:
        print(f"Failed to load model with open_clip: {e}")
        return

    # Walk directory
    if not os.path.exists(args.dir):
        print(f"Directory {args.dir} does not exist.")
        return

    supported_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    
    # Check if the dir has subfolders (labels) or just images
    # We assume subfolders as labels: ./dataset/Estrus/img1.jpg
    
    subfolders = [d for d in os.listdir(args.dir) if os.path.isdir(os.path.join(args.dir, d))]
    
    if not subfolders:
        print(f"No subdirectories found in {args.dir}. Expected structure: {args.dir}/<Label>/<Image.jpg>")
        return

    for label in subfolders:
        label_path = os.path.join(args.dir, label)
        print(f"\nProcessing Class: {label}")
        
        files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in supported_exts]
        
        for fname in tqdm(files):
            fpath = os.path.join(label_path, fname)
            
            embedding = get_embedding(model, processor, fpath)
            if embedding:
                data = {
                    "label": label,
                    "embedding": embedding,
                    "image_path": fpath, # Optional: could store GCS url if we uploaded it
                    "metadata": {"filename": fname, "original_path": fpath}
                }
                
                try:
                    supabase.table("reference_images").insert(data).execute()
                except Exception as db_err:
                    print(f"Database insert error for {fname}: {db_err}")

    print("\nIngestion complete.")

if __name__ == "__main__":
    asyncio.run(main())

