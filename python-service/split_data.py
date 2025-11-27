import os
import random
import shutil
import argparse
from typing import List, Tuple

def parse_label(filename: str) -> str:
    # Try to extract label from filename like "222_10_11_METESTRUS.jpg"
    # Split by underscore, look for known stages
    parts = filename.replace(".", "_").split("_")
    valid_stages = {"PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS"}
    
    for part in parts:
        upper_part = part.upper()
        # Fix common typos if necessary
        if upper_part == "PROESTTRUS": upper_part = "PROESTRUS"
        
        if upper_part in valid_stages:
            return upper_part
            
    return "UNKNOWN"

def split_dataset(source_dir: str, output_dir: str, split_ratio: float = 0.8):
    """
    Splits images from source_dir into output_dir/train and output_dir/test
    based on the label found in the filename.
    """
    if not os.path.exists(source_dir):
        print(f"Source directory {source_dir} not found.")
        return

    train_dir = os.path.join(output_dir, "train")
    test_dir = os.path.join(output_dir, "test")
    
    # Create dirs
    for stage in ["PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS", "UNKNOWN"]:
        os.makedirs(os.path.join(train_dir, stage), exist_ok=True)
        os.makedirs(os.path.join(test_dir, stage), exist_ok=True)
        
    valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

    # Check if source_dir has subfolders (Class Structure) or flat files
    subfolders = [d for d in os.listdir(source_dir) if os.path.isdir(os.path.join(source_dir, d))]
    files_by_label = {}
    
    if subfolders:
        print("Detected Class Subfolder Structure.")
        for label in subfolders:
            label_path = os.path.join(source_dir, label)
            label_files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in valid_exts]
            # Store as (filename, full_source_path)
            files_by_label[label] = [(f, os.path.join(label_path, f)) for f in label_files]
    else:
        print("Detected Flat Directory Structure.")
        files = [f for f in os.listdir(source_dir) if os.path.splitext(f)[1].lower() in valid_exts]
        for f in files:
            label = parse_label(f)
            if label not in files_by_label:
                files_by_label[label] = []
            files_by_label[label].append((f, os.path.join(source_dir, f)))
        
    print(f"Found images distributed across labels:")
    for label, items in files_by_label.items():
        print(f"  - {label}: {len(items)}")
        
    # Split and copy
    for label, items in files_by_label.items():
        random.shuffle(items)
        split_idx = int(len(items) * split_ratio)
        train_items = items[:split_idx]
        test_items = items[split_idx:]
        
        for fname, src_path in train_items:
            shutil.copy2(src_path, os.path.join(train_dir, label, fname))
            
        for fname, src_path in test_items:
            shutil.copy2(src_path, os.path.join(test_dir, label, fname))
            
    print(f"\nDataset split complete!")
    print(f"Train: {train_dir}")
    print(f"Test: {test_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="./MPP", help="Source directory containing images")
    parser.add_argument("--output", default="./dataset_split", help="Output directory for split datasets")
    parser.add_argument("--ratio", type=float, default=0.8, help="Training set ratio (default: 0.8)")
    args = parser.parse_args()
    
    split_dataset(args.source, args.output, args.ratio)

