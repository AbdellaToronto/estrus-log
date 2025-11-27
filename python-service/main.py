"""
BioCLIP Embedding + Classification Service

This service:
1. Receives an image
2. Uses a configurable segmentation model to crop the target region:
   - "sam3_cloud" (default): SAM3 via Hugging Face Inference Endpoint (fastest, best quality)
   - "evf": EVF-SAM2 - text-prompted segmentation (local)
   - "sam2": SAM 2.1 - center-point prompted segmentation (local)
   - "owlv2": OWLv2 - zero-shot object detection (local)
3. Generates BioCLIP embeddings from the cropped image
4. Classifies using Linear Probe or returns embedding for k-NN

Environment Variables:
- SEGMENTATION_MODEL: "sam3_cloud" (default), "evf", "sam2", or "owlv2"
- SEGMENTATION_PROMPT: Text prompt for SAM3/EVF/OWLv2 (default: "mouse genitalia")
- USE_LINEAR_PROBE: "true" to use Linear Probe, "false" for k-NN via /embed
- SAM3_ENDPOINT_URL: URL for SAM3 cloud endpoint (required if using sam3_cloud)
- HF_TOKEN: Hugging Face token for SAM3 cloud endpoint

To run:
    python main.py
"""

import os
import io
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from PIL import Image
import torch
import numpy as np
import open_clip
import joblib
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BioCLIP Classification Service")

# Configuration
# Segmentation options: "sam3_cloud" (recommended), "evf", "sam2", "owlv2"
SEGMENTATION_MODEL = os.environ.get("SEGMENTATION_MODEL", "sam3_cloud").lower()
USE_LINEAR_PROBE = os.environ.get("USE_LINEAR_PROBE", "false").lower() == "true"
SEGMENTATION_PROMPT = os.environ.get("SEGMENTATION_PROMPT", "mouse genitalia")

# Global variables
bioclip_model = None
bioclip_preprocess = None
classifier_data = None

# Segmentation - we'll use the wrapper for EVF
evf_loaded = False

# Valid estrus stages
VALID_STAGES = ["PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS"]


class ClassificationResponse(BaseModel):
    """Response model for classification endpoint."""
    estrus_stage: str
    confidence_scores: Dict[str, float]
    cropped: bool  # Whether segmentation cropping was applied


class EmbeddingResponse(BaseModel):
    """Response model for embedding endpoint."""
    embedding: List[float]


def load_evf_sam2():
    """Load EVF-SAM2 model for text-prompted segmentation."""
    global evf_loaded
    from evf_sam_wrapper import load_evf_sam2 as _load_evf
    _load_evf(precision="fp32")
    evf_loaded = True


def segment_with_evf(image: Image.Image, prompt: str) -> Optional[Image.Image]:
    """Use EVF-SAM2 for text-prompted segmentation."""
    from evf_sam_wrapper import segment_with_evf_sam2
    return segment_with_evf_sam2(image, prompt)


def load_sam2():
    """Load SAM 2.1 model for point-prompted segmentation."""
    global sam2_model, sam2_processor
    from transformers import Sam2Processor, Sam2Model
    
    print("Loading SAM 2.1 model...")
    sam2_processor = Sam2Processor.from_pretrained("facebook/sam2.1-hiera-large")
    sam2_model = Sam2Model.from_pretrained("facebook/sam2.1-hiera-large")
    sam2_model.eval()
    print("SAM 2.1 loaded successfully.")


def segment_with_sam2(image: Image.Image) -> Optional[Image.Image]:
    """Use SAM 2.1 with center point prompt."""
    if sam2_model is None or sam2_processor is None:
        return None
    
    try:
        w, h = image.size
        center_x, center_y = w // 2, h // 2
        
        input_points = [[[[center_x, center_y]]]]
        input_labels = [[[1]]]
        
        inputs = sam2_processor(
            images=image, 
            input_points=input_points, 
            input_labels=input_labels, 
            return_tensors="pt"
        )
        
        with torch.no_grad():
            outputs = sam2_model(**inputs)
        
        masks = sam2_processor.post_process_masks(
            outputs.pred_masks.cpu(), 
            inputs["original_sizes"]
        )[0]
        
        if masks.shape[0] > 0:
            mask = masks[0, 0].numpy()
            rows = np.any(mask, axis=1)
            cols = np.any(mask, axis=0)
            
            if rows.any() and cols.any():
                ymin, ymax = np.where(rows)[0][[0, -1]]
                xmin, xmax = np.where(cols)[0][[0, -1]]
                
                padding = 20
                xmin = max(0, xmin - padding)
                ymin = max(0, ymin - padding)
                xmax = min(w, xmax + padding)
                ymax = min(h, ymax + padding)
                
                return image.crop((xmin, ymin, xmax, ymax))
        
        return None
    except Exception as e:
        print(f"SAM 2.1 segmentation error: {e}")
        return None


def load_owlv2():
    """Load OWLv2 model for zero-shot object detection."""
    global owlv2_model, owlv2_processor
    from transformers import Owlv2Processor, Owlv2ForObjectDetection
    
    print("Loading OWLv2 model...")
    owlv2_processor = Owlv2Processor.from_pretrained("google/owlv2-base-patch16-ensemble")
    owlv2_model = Owlv2ForObjectDetection.from_pretrained("google/owlv2-base-patch16-ensemble")
    owlv2_model.eval()
    print("OWLv2 loaded successfully.")


def segment_with_owlv2(image: Image.Image, prompt: str) -> Optional[Image.Image]:
    """Use OWLv2 for zero-shot object detection."""
    if owlv2_model is None or owlv2_processor is None:
        return None
    
    try:
        inputs = owlv2_processor(text=[[prompt]], images=image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = owlv2_model(**inputs)
        
        target_sizes = torch.Tensor([image.size[::-1]])
        results = owlv2_processor.post_process_grounded_object_detection(
            outputs=outputs, 
            target_sizes=target_sizes, 
            threshold=0.1
        )[0]
        
        if len(results["boxes"]) > 0:
            best_idx = results["scores"].argmax()
            box = results["boxes"][best_idx].tolist()
            return image.crop((box[0], box[1], box[2], box[3]))
        
        return None
    except Exception as e:
        print(f"OWLv2 segmentation error: {e}")
        return None


# Add global variables for sam2 and owlv2
sam2_model = None
sam2_processor = None
owlv2_model = None
owlv2_processor = None


def segment_image(image: Image.Image) -> Optional[Image.Image]:
    """Segment image using the configured model."""
    if SEGMENTATION_MODEL == "sam3_cloud":
        from sam3_cloud import segment_with_sam3_cloud
        result, error = segment_with_sam3_cloud(
            image, 
            prompt=SEGMENTATION_PROMPT,
            bg_mode="mask_crop",
            bg_color="black"
        )
        if error:
            print(f"SAM3 cloud segmentation error: {error}")
        return result
    elif SEGMENTATION_MODEL == "evf":
        return segment_with_evf(image, SEGMENTATION_PROMPT)
    elif SEGMENTATION_MODEL == "sam2":
        return segment_with_sam2(image)
    elif SEGMENTATION_MODEL == "owlv2":
        return segment_with_owlv2(image, SEGMENTATION_PROMPT)
    return None


@app.on_event("startup")
async def load_models():
    """Load all models on startup."""
    global bioclip_model, bioclip_preprocess, classifier_data
    
    # Load BioCLIP
    print("Loading BioCLIP model...")
    try:
        model_name = 'hf-hub:imageomics/bioclip'
        bioclip_model, _, bioclip_preprocess = open_clip.create_model_and_transforms(model_name)
        bioclip_model.eval()
        print("BioCLIP model loaded successfully.")
    except Exception as e:
        print(f"Error loading BioCLIP model: {e}")
        raise e
    
    # Load Linear Probe classifier
    classifier_path = os.path.join(os.path.dirname(__file__), "classifier.pkl")
    if os.path.exists(classifier_path):
        print("Loading Linear Probe classifier...")
        try:
            classifier_data = joblib.load(classifier_path)
            print(f"Classifier loaded. Classes: {classifier_data['classes']}")
        except Exception as e:
            print(f"Warning: Could not load classifier: {e}")
            classifier_data = None
    else:
        print(f"Warning: Classifier not found at {classifier_path}.")
        classifier_data = None
    
    # Load segmentation model based on config
    print(f"Configured segmentation model: {SEGMENTATION_MODEL}")
    if SEGMENTATION_MODEL in ["evf", "owlv2", "sam3_cloud"]:
        print(f"Segmentation prompt: '{SEGMENTATION_PROMPT}'")
    
    try:
        if SEGMENTATION_MODEL == "sam3_cloud":
            # SAM3 cloud doesn't need local model loading
            from sam3_cloud import is_endpoint_ready
            if is_endpoint_ready():
                print("✅ SAM3 cloud endpoint is ready!")
            else:
                print("⏳ SAM3 cloud endpoint not ready yet (will retry on each request)")
        elif SEGMENTATION_MODEL == "evf":
            load_evf_sam2()
        elif SEGMENTATION_MODEL == "sam2":
            load_sam2()
        elif SEGMENTATION_MODEL == "owlv2":
            load_owlv2()
    except Exception as e:
        print(f"Warning: Failed to load segmentation model ({SEGMENTATION_MODEL}): {e}")
        print("Auto-cropping will be disabled.")


def get_bioclip_embedding(image: Image.Image) -> np.ndarray:
    """Generate a BioCLIP embedding for an image."""
    image_tensor = bioclip_preprocess(image).unsqueeze(0)
    with torch.no_grad():
        outputs = bioclip_model.encode_image(image_tensor)
        features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
        embedding = features.squeeze().numpy()
    return embedding


def classify_with_linear_probe(embedding: np.ndarray) -> Dict[str, Any]:
    """Classify an embedding using the trained Linear Probe."""
    if classifier_data is None:
        raise ValueError("Classifier not loaded")
    
    classifier = classifier_data['classifier']
    label_encoder = classifier_data['label_encoder']
    
    embedding_2d = embedding.reshape(1, -1)
    prediction = classifier.predict(embedding_2d)[0]
    probabilities = classifier.predict_proba(embedding_2d)[0]
    
    predicted_stage = label_encoder.inverse_transform([prediction])[0]
    
    confidence_scores = {}
    for i, class_name in enumerate(label_encoder.classes_):
        formatted_name = class_name.capitalize()
        confidence_scores[formatted_name] = float(probabilities[i])
    
    return {
        "estrus_stage": predicted_stage.capitalize(),
        "confidence_scores": confidence_scores
    }


@app.get("/")
async def health_check():
    """Health check endpoint."""
    segmentation_enabled = (
        (SEGMENTATION_MODEL == "evf" and evf_loaded) or
        (SEGMENTATION_MODEL == "sam2" and sam2_model is not None) or
        (SEGMENTATION_MODEL == "owlv2" and owlv2_model is not None)
    )
    return {
        "status": "ready",
        "bioclip_loaded": bioclip_model is not None,
        "classifier_loaded": classifier_data is not None,
        "segmentation_model": SEGMENTATION_MODEL,
        "segmentation_enabled": segmentation_enabled,
        "use_linear_probe": USE_LINEAR_PROBE
    }


@app.post("/embed", response_model=EmbeddingResponse)
async def generate_embedding(file: UploadFile = File(...)):
    """Generate a BioCLIP embedding for an uploaded image."""
    if not bioclip_model or not bioclip_preprocess:
        raise HTTPException(status_code=503, detail="BioCLIP model not initialized")
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        cropped_image = segment_image(image)
        if cropped_image is not None:
            image = cropped_image
        
        embedding = get_bioclip_embedding(image)
        
        return {"embedding": embedding.tolist()}
        
    except Exception as e:
        print(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/classify", response_model=ClassificationResponse)
async def classify_image(file: UploadFile = File(...)):
    """Classify an uploaded image into an estrus stage."""
    if not bioclip_model or not bioclip_preprocess:
        raise HTTPException(status_code=503, detail="BioCLIP model not initialized")
    
    if not USE_LINEAR_PROBE:
        raise HTTPException(
            status_code=400, 
            detail="Linear Probe disabled. Use /embed endpoint for k-NN classification."
        )
    
    if classifier_data is None:
        raise HTTPException(
            status_code=503, 
            detail="Classifier not loaded. Run train_classifier.py first."
        )
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        cropped_image = segment_image(image)
        was_cropped = cropped_image is not None
        if was_cropped:
            image = cropped_image
        
        embedding = get_bioclip_embedding(image)
        result = classify_with_linear_probe(embedding)
        
        return ClassificationResponse(
            estrus_stage=result["estrus_stage"],
            confidence_scores=result["confidence_scores"],
            cropped=was_cropped
        )
        
    except ValueError as ve:
        raise HTTPException(status_code=503, detail=str(ve))
    except Exception as e:
        print(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=f"Error classifying image: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
