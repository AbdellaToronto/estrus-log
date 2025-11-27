import os
import zipfile
import shutil
from PIL import Image
from pillow_heif import register_heif_opener
import argparse
from tqdm import tqdm

register_heif_opener()

def process_zips(root_dir: str, output_dir: str):
    zips = [f for f in os.listdir(root_dir) if f.endswith(".zip")]
    
    for zip_name in zips:
        # Assume zip name is the label (e.g. "estrus.zip" -> "Estrus")
        label = os.path.splitext(zip_name)[0].upper()
        if label == "ESTRUS": label = "ESTRUS" # Normalization if needed
        
        print(f"Processing {zip_name} as {label}...")
        
        zip_path = os.path.join(root_dir, zip_name)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Extract to temp dir
            temp_dir = os.path.join(output_dir, "temp", label)
            zip_ref.extractall(temp_dir)
            
            # Walk and move images
            target_dir = os.path.join(output_dir, label)
            os.makedirs(target_dir, exist_ok=True)
            
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    if file.startswith("._"): continue # Mac junk
                    if file.lower().endswith((".heic", ".jpg", ".jpeg", ".png")):
                        src = os.path.join(root, file)
                        
                        # Convert HEIC to JPG
                        try:
                            img = Image.open(src)
                            # Convert to RGB if needed
                            if img.mode != 'RGB':
                                img = img.convert('RGB')
                                
                            # Save as JPG
                            new_name = os.path.splitext(file)[0] + ".jpg"
                            dst = os.path.join(target_dir, new_name)
                            img.save(dst, "JPEG", quality=90)
                        except Exception as e:
                            print(f"Failed to convert {file}: {e}")
            
            # Cleanup temp
            shutil.rmtree(os.path.join(output_dir, "temp"))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="../dataset_raw", help="Output directory")
    args = parser.parse_args()
    
    process_zips("..", args.output)






