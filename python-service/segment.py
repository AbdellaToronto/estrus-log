import os
import argparse
from PIL import Image
import torch
from transformers import Owlv2Processor, Owlv2ForObjectDetection
from tqdm import tqdm

def crop_genitals(
    input_dir: str, 
    output_dir: str, 
    prompt_text: str = "mouse genitalia", 
    threshold: float = 0.1
):
    print(f"Loading OWLv2 for zero-shot detection of '{prompt_text}'...")
    
    # Use OWLv2 which is available in transformers and easy to install
    model_id = "google/owlv2-base-patch16-ensemble"
    processor = Owlv2Processor.from_pretrained(model_id)
    model = Owlv2ForObjectDetection.from_pretrained(model_id)
    model.eval()
    
    if not os.path.exists(input_dir):
        print(f"Input directory {input_dir} not found.")
        return

    # Walk through input directory
    supported_exts = {".jpg", ".jpeg", ".png", ".webp"}
    
    # We expect subfolders (labels)
    subfolders = [d for d in os.listdir(input_dir) if os.path.isdir(os.path.join(input_dir, d))]
    
    for label in subfolders:
        label_path = os.path.join(input_dir, label)
        output_label_path = os.path.join(output_dir, label)
        os.makedirs(output_label_path, exist_ok=True)
        
        files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in supported_exts]
        
        print(f"Processing {label} ({len(files)} images)...")
        
        for fname in tqdm(files):
            fpath = os.path.join(label_path, fname)
            try:
                image = Image.open(fpath).convert("RGB")
                
                # Prepare inputs
                texts = [[prompt_text]]
                inputs = processor(text=texts, images=image, return_tensors="pt")
                
                # Inference
                with torch.no_grad():
                    outputs = model(**inputs)
                
                # Post-process (updated API for newer transformers)
                target_sizes = torch.Tensor([image.size[::-1]])
                results = processor.post_process_grounded_object_detection(
                    outputs=outputs, 
                    target_sizes=target_sizes, 
                    threshold=threshold
                )[0]
                
                # Find best box (highest score)
                if len(results["scores"]) > 0:
                    best_idx = results["scores"].argmax().item()
                    box = results["boxes"][best_idx].tolist() # [xmin, ymin, xmax, ymax]
                    
                    # Expand box slightly (context) - optional
                    w, h = image.size
                    padding = 20
                    xmin, ymin, xmax, ymax = box
                    xmin = max(0, xmin - padding)
                    ymin = max(0, ymin - padding)
                    xmax = min(w, xmax + padding)
                    ymax = min(h, ymax + padding)
                    
                    cropped_img = image.crop((xmin, ymin, xmax, ymax))
                    cropped_img.save(os.path.join(output_label_path, fname))
                else:
                    # No detection, save original or skip? Saving original for now to avoid data loss
                    # print(f"No detection for {fname}, saving original.")
                    image.save(os.path.join(output_label_path, fname))
                    
            except Exception as e:
                print(f"Error processing {fname}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="../dataset_raw", help="Input directory with subfolders")
    parser.add_argument("--output", default="../dataset_cropped", help="Output directory")
    parser.add_argument("--prompt", default="mouse genitalia", help="Text prompt for detection")
    parser.add_argument("--threshold", type=float, default=0.1, help="Confidence threshold")
    args = parser.parse_args()
    
    crop_genitals(args.input, args.output, args.prompt, args.threshold)



