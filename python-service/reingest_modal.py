"""
Re-ingest reference images using the Modal BioCLIP service.
This ensures reference embeddings match the embeddings generated for new images.
"""

import os
import asyncio
import base64
import httpx
from pathlib import Path
from supabase import create_client, Client
from PIL import Image
from io import BytesIO
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()

BIOCLIP_URL = os.environ.get(
    "BIOCLIP_API_URL",
    "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run"
)

async def get_embedding_from_modal(client: httpx.AsyncClient, image_path: str) -> list[float] | None:
    """Get embedding from Modal BioCLIP service."""
    try:
        # Load and convert image to base64
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=95)
            base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        # Call Modal endpoint
        response = await client.post(
            BIOCLIP_URL,
            json={"image": base64_image},
            timeout=60.0
        )
        response.raise_for_status()
        
        result = response.json()
        return result.get("embedding")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return None


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Re-ingest reference images using Modal BioCLIP")
    parser.add_argument("--dir", required=True, help="Path to dataset directory (e.g. ./dataset_split_cropped/train)")
    parser.add_argument("--clear", action="store_true", help="Clear existing reference images before ingesting")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually insert, just test")
    args = parser.parse_args()

    # Load Supabase credentials
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars")
        return

    print(f"Connecting to Supabase at {url}...")
    supabase: Client = create_client(url, key)

    if args.clear and not args.dry_run:
        print("Clearing existing reference images...")
        supabase.table("reference_images").delete().neq("label", "INVALID_LABEL_PLACEHOLDER").execute()
        print("Cleared!")

    # Find all class subdirectories
    base_dir = Path(args.dir)
    if not base_dir.exists():
        print(f"Directory {args.dir} does not exist.")
        return

    subfolders = [d for d in base_dir.iterdir() if d.is_dir()]
    if not subfolders:
        print(f"No subdirectories found in {args.dir}")
        return

    print(f"Found classes: {[d.name for d in subfolders]}")
    print(f"Using BioCLIP endpoint: {BIOCLIP_URL}")
    
    # Process images
    supported_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    total_processed = 0
    total_failed = 0

    async with httpx.AsyncClient() as client:
        for label_dir in subfolders:
            label = label_dir.name.upper()  # Normalize to uppercase (ESTRUS, PROESTRUS, etc.)
            print(f"\nProcessing Class: {label}")
            
            files = [f for f in label_dir.iterdir() if f.suffix.lower() in supported_exts]
            
            for fpath in tqdm(files, desc=label):
                embedding = await get_embedding_from_modal(client, str(fpath))
                
                if embedding:
                    if args.dry_run:
                        print(f"  [DRY RUN] Would insert {fpath.name} with {len(embedding)}-dim embedding")
                    else:
                        data = {
                            "label": label,
                            "embedding": embedding,
                            "image_path": fpath.name,
                            "metadata": {
                                "filename": fpath.name,
                                "source": "modal_bioclip",
                                "segmentation": "none"  # No cropping!
                            }
                        }
                        
                        try:
                            supabase.table("reference_images").insert(data).execute()
                            total_processed += 1
                        except Exception as db_err:
                            print(f"Database insert error for {fpath.name}: {db_err}")
                            total_failed += 1
                else:
                    total_failed += 1

    print(f"\n✅ Ingestion complete!")
    print(f"   Processed: {total_processed}")
    print(f"   Failed: {total_failed}")


if __name__ == "__main__":
    asyncio.run(main())


