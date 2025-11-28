"""
SAM3 + BioCLIP Cloud Pipeline on Modal.com

Provides:
1. SAM3 segmentation with "mouse body" mask crop
2. BioCLIP embedding generation
3. Classification inference

Usage:
    modal deploy sam3_modal.py
"""

import modal

# Create Modal app
app = modal.App("estrus-pipeline")

# Reference secrets
hf_secret = modal.Secret.from_name("huggingface")

# =============================================================================
# SAM3 Segmentation
# =============================================================================

sam3_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "pillow",
        "numpy==1.26",
        "fastapi",
        "huggingface_hub",
    )
    .run_commands(
        "git clone --recursive https://github.com/facebookresearch/sam3.git /opt/sam3",
        "cd /opt/sam3 && pip install -e '.[notebooks]'",
    )
)


@app.cls(
    image=sam3_image,
    gpu="A10G",
    timeout=600,
    scaledown_window=300,
    secrets=[hf_secret],
)
class SAM3Segmenter:
    """SAM3 text-prompted segmentation - extracts mouse body with background removed."""
    
    @modal.enter()
    def load_model(self):
        import os
        import torch
        from huggingface_hub import login
        
        hf_token = os.environ.get("HF_TOKEN")
        if hf_token:
            login(token=hf_token)
            print("✅ Logged into HuggingFace")
        
        if torch.cuda.is_available():
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            print("✅ Enabled TF32 optimizations")
        
        import sam3
        from sam3 import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
        
        sam3_root = os.path.join(os.path.dirname(sam3.__file__), "..")
        bpe_path = f"{sam3_root}/assets/bpe_simple_vocab_16e6.txt.gz"
        
        print(f"Loading SAM3 model...")
        self.model = build_sam3_image_model(bpe_path=bpe_path)
        self.processor = Sam3Processor(self.model, confidence_threshold=0.5)
        print("✅ SAM3 loaded!")
    
    @modal.method()
    def segment(
        self,
        image_bytes: bytes,
        prompt: str = "mouse body",
        bg_mode: str = "mask_crop",
    ) -> bytes:
        """
        Segment image with SAM3 and return cropped result.
        
        Args:
            image_bytes: Input image as bytes
            prompt: Text prompt (default: "mouse body")
            bg_mode: "mask_crop" (black bg), "transparent", "crop" (no mask)
        
        Returns:
            Cropped image as bytes
        """
        import io
        import torch
        from PIL import Image
        import numpy as np
        
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = image.size
        
        print(f"🔍 Segmenting with '{prompt}'...")
        
        with torch.autocast("cuda", dtype=torch.bfloat16):
            inference_state = self.processor.set_image(image)
            self.processor.reset_all_prompts(inference_state)
            output = self.processor.set_text_prompt(state=inference_state, prompt=prompt)
        
        masks = output.get("masks", [])
        scores = output.get("scores", [])
        
        print(f"📊 Found {len(masks)} mask(s)")
        
        if len(masks) == 0:
            print(f"⚠️ No mask found, returning original")
            output_buffer = io.BytesIO()
            image.save(output_buffer, format="JPEG", quality=95)
            return output_buffer.getvalue()
        
        # Get best mask
        best_idx = 0
        if len(scores) > 0:
            try:
                if isinstance(scores, torch.Tensor):
                    scores_np = scores.detach().cpu().float().numpy()
                else:
                    scores_np = np.array(scores)
                best_idx = int(np.argmax(scores_np))
                print(f"   Best mask score: {scores_np[best_idx]:.4f}")
            except:
                pass
        
        mask = masks[best_idx]
        if hasattr(mask, 'cpu'):
            mask_np = mask.cpu().numpy()
        else:
            mask_np = np.array(mask)
        
        if mask_np.ndim > 2:
            mask_np = mask_np.squeeze()
        mask_np = mask_np > 0.5
        
        # Find bounding box
        rows = np.any(mask_np, axis=1)
        cols = np.any(mask_np, axis=0)
        
        if not rows.any() or not cols.any():
            print(f"⚠️ Empty mask, returning original")
            output_buffer = io.BytesIO()
            image.save(output_buffer, format="JPEG", quality=95)
            return output_buffer.getvalue()
        
        y_min, y_max = np.where(rows)[0][[0, -1]]
        x_min, x_max = np.where(cols)[0][[0, -1]]
        
        # Add padding
        pad = 10
        x_min = max(0, x_min - pad)
        y_min = max(0, y_min - pad)
        x_max = min(w, x_max + pad)
        y_max = min(h, y_max + pad)
        
        print(f"📐 Crop: {x_max-x_min}x{y_max-y_min}")
        
        # Apply background mode
        img_array = np.array(image)
        
        if bg_mode == "transparent":
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            rgba[:, :, :3] = img_array
            rgba[:, :, 3] = (mask_np * 255).astype(np.uint8)
            result = Image.fromarray(rgba, mode="RGBA")
            result = result.crop((x_min, y_min, x_max, y_max))
            output_buffer = io.BytesIO()
            result.save(output_buffer, format="PNG")
            return output_buffer.getvalue()
        
        elif bg_mode == "mask_crop":
            bg = np.zeros_like(img_array)
            result_array = np.where(mask_np[:, :, np.newaxis], img_array, bg)
            result = Image.fromarray(result_array)
            result = result.crop((x_min, y_min, x_max, y_max))
        
        else:  # "crop"
            result = image.crop((x_min, y_min, x_max, y_max))
        
        output_buffer = io.BytesIO()
        result.save(output_buffer, format="JPEG", quality=95)
        return output_buffer.getvalue()


# =============================================================================
# OWLv2 Object Detection (for cropping)
# =============================================================================

owlv2_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "pillow",
        "numpy",
        "scipy",
        "transformers",
        "fastapi",
    )
)


@app.cls(
    image=owlv2_image,
    gpu="T4",
    timeout=300,
    scaledown_window=300,
)
class OWLv2Detector:
    """OWLv2 zero-shot object detection for cropping."""
    
    @modal.enter()
    def load_model(self):
        import torch
        from transformers import Owlv2Processor, Owlv2ForObjectDetection
        
        print("Loading OWLv2...")
        self.processor = Owlv2Processor.from_pretrained("google/owlv2-base-patch16-ensemble")
        self.model = Owlv2ForObjectDetection.from_pretrained("google/owlv2-base-patch16-ensemble")
        
        if torch.cuda.is_available():
            self.model = self.model.cuda()
        
        self.model.eval()
        print("✅ OWLv2 loaded!")
    
    @modal.method()
    def detect_and_crop(
        self,
        image_bytes: bytes,
        queries: list = None,
        threshold: float = 0.05,
    ) -> bytes:
        """
        Detect objects and crop to best detection.
        
        Args:
            image_bytes: Input image
            queries: Text queries for detection
            threshold: Detection confidence threshold
        
        Returns:
            Cropped image bytes
        """
        import io
        import torch
        from PIL import Image
        
        if queries is None:
            queries = ["mouse", "rodent", "animal"]
        
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Process
        inputs = self.processor(text=[queries], images=image, return_tensors="pt")
        
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # Post-process - use the model's image_processor for post-processing
        target_sizes = torch.tensor([image.size[::-1]])
        if torch.cuda.is_available():
            target_sizes = target_sizes.cuda()
        
        # Get predictions
        results = self.processor.image_processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=threshold
        )[0]
        
        boxes = results["boxes"]
        scores = results["scores"]
        
        print(f"📊 OWLv2 found {len(boxes)} detection(s)")
        
        if len(boxes) == 0:
            print("⚠️ No detections, returning original")
            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=95)
            return buf.getvalue()
        
        # Get best box
        best_idx = scores.argmax().item()
        box = boxes[best_idx].cpu().tolist()
        score = scores[best_idx].item()
        
        print(f"   Best detection score: {score:.3f}")
        
        # Crop with padding
        x1, y1, x2, y2 = box
        pad = 20
        x1 = max(0, int(x1) - pad)
        y1 = max(0, int(y1) - pad)
        x2 = min(image.width, int(x2) + pad)
        y2 = min(image.height, int(y2) + pad)
        
        cropped = image.crop((x1, y1, x2, y2))
        print(f"   Crop size: {cropped.size}")
        
        buf = io.BytesIO()
        cropped.save(buf, format="JPEG", quality=95)
        return buf.getvalue()


# =============================================================================
# BioCLIP Embedding
# =============================================================================

bioclip_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "pillow",
        "numpy",
        "open_clip_torch",
        "fastapi",
    )
)


@app.cls(
    image=bioclip_image,
    gpu="T4",
    timeout=300,
    scaledown_window=300,
)
class BioCLIPEmbedder:
    """Generate BioCLIP embeddings for images."""
    
    @modal.enter()
    def load_model(self):
        import torch
        import open_clip
        
        print("Loading BioCLIP...")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            'hf-hub:imageomics/bioclip'
        )
        self.model.eval()
        
        if torch.cuda.is_available():
            self.model = self.model.cuda()
        
        print("✅ BioCLIP loaded!")
    
    @modal.method()
    def embed(self, image_bytes: bytes) -> list:
        """Generate embedding for an image."""
        import io
        import torch
        from PIL import Image
        
        # Validate image bytes
        if not image_bytes or len(image_bytes) < 100:
            raise ValueError(f"Invalid image bytes: received {len(image_bytes) if image_bytes else 0} bytes")
        
        # Check for common error responses (HTML/text instead of image)
        try:
            preview = image_bytes[:50].decode('utf-8', errors='ignore').lower()
            if '<html' in preview or '<!doctype' in preview or 'error' in preview:
                raise ValueError(f"Received HTML/error instead of image data: {preview[:100]}")
        except:
            pass  # Binary data, which is expected
        
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            # Log more details about what we received
            print(f"Failed to open image. Bytes length: {len(image_bytes)}, first 20 bytes: {image_bytes[:20]}")
            raise ValueError(f"Cannot decode image: {str(e)}")
        
        image_tensor = self.preprocess(image).unsqueeze(0)
        
        if torch.cuda.is_available():
            image_tensor = image_tensor.cuda()
        
        with torch.no_grad():
            features = self.model.encode_image(image_tensor)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
        
        return features.squeeze().cpu().tolist()
    
    @modal.method()
    def embed_batch(self, images_bytes: list) -> list:
        """Generate embeddings for multiple images."""
        import io
        import torch
        from PIL import Image
        
        tensors = []
        for img_bytes in images_bytes:
            image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            tensors.append(self.preprocess(image))
        
        batch = torch.stack(tensors)
        if torch.cuda.is_available():
            batch = batch.cuda()
        
        with torch.no_grad():
            features = self.model.encode_image(batch)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
        
        return features.cpu().tolist()


# =============================================================================
# Classification
# =============================================================================

classifier_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy",
        "scikit-learn",
        "joblib",
    )
)


@app.cls(
    image=classifier_image,
    timeout=300,
    scaledown_window=300,
)
class EstrusClassifier:
    """Classify estrus stage from BioCLIP embeddings."""
    
    classifier = None
    label_encoder = None
    
    @modal.method()
    def train(self, embeddings: list, labels: list) -> dict:
        """Train classifier on embeddings."""
        import numpy as np
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import LabelEncoder
        
        X = np.array(embeddings)
        
        self.label_encoder = LabelEncoder()
        y = self.label_encoder.fit_transform(labels)
        
        self.classifier = LogisticRegression(
            random_state=42,
            solver='liblinear',
            multi_class='ovr',
            class_weight='balanced',
            C=0.1,
            max_iter=1000,
        )
        self.classifier.fit(X, y)
        
        # Get training accuracy
        train_acc = self.classifier.score(X, y)
        
        return {
            "train_accuracy": train_acc,
            "classes": self.label_encoder.classes_.tolist(),
            "n_samples": len(labels),
        }
    
    @modal.method()
    def predict(self, embedding: list) -> dict:
        """Predict estrus stage from embedding."""
        import numpy as np
        
        if self.classifier is None:
            return {"error": "Classifier not trained"}
        
        X = np.array(embedding).reshape(1, -1)
        
        pred_idx = self.classifier.predict(X)[0]
        pred_proba = self.classifier.predict_proba(X)[0]
        
        pred_label = self.label_encoder.inverse_transform([pred_idx])[0]
        
        confidence_scores = {
            label: float(prob)
            for label, prob in zip(self.label_encoder.classes_, pred_proba)
        }
        
        return {
            "prediction": pred_label,
            "confidence": float(pred_proba[pred_idx]),
            "confidence_scores": confidence_scores,
        }
    
    @modal.method()
    def predict_batch(self, embeddings: list) -> list:
        """Predict estrus stages for multiple embeddings."""
        import numpy as np
        
        if self.classifier is None:
            return [{"error": "Classifier not trained"}] * len(embeddings)
        
        X = np.array(embeddings)
        
        pred_indices = self.classifier.predict(X)
        pred_probas = self.classifier.predict_proba(X)
        
        results = []
        for i, (pred_idx, pred_proba) in enumerate(zip(pred_indices, pred_probas)):
            pred_label = self.label_encoder.inverse_transform([pred_idx])[0]
            confidence_scores = {
                label: float(prob)
                for label, prob in zip(self.label_encoder.classes_, pred_proba)
            }
            results.append({
                "prediction": pred_label,
                "confidence": float(pred_proba[pred_idx]),
                "confidence_scores": confidence_scores,
            })
        
        return results


# =============================================================================
# HTTP Endpoints
# =============================================================================

@app.function(image=sam3_image, gpu="A10G", timeout=600, secrets=[hf_secret])
@modal.fastapi_endpoint(method="POST")
def segment_endpoint(item: dict):
    """HTTP endpoint for SAM3 segmentation."""
    import base64
    
    image_b64 = item.get("image")
    prompt = item.get("prompt", "mouse body")
    bg_mode = item.get("bg_mode", "mask_crop")
    
    if not image_b64:
        return {"error": "No image provided"}
    
    image_bytes = base64.b64decode(image_b64)
    
    segmenter = SAM3Segmenter()
    result_bytes = segmenter.segment.remote(image_bytes, prompt, bg_mode)
    
    return {
        "image": base64.b64encode(result_bytes).decode("utf-8"),
        "format": "png" if bg_mode == "transparent" else "jpeg",
    }


@app.function(image=bioclip_image, gpu="T4", timeout=300)
@modal.fastapi_endpoint(method="POST")
def embed_endpoint(item: dict):
    """HTTP endpoint for BioCLIP embedding."""
    import base64
    
    image_b64 = item.get("image")
    if not image_b64:
        return {"error": "No image provided"}
    
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception as e:
        return {"error": f"Invalid base64 encoding: {str(e)}"}
    
    if len(image_bytes) < 100:
        return {"error": f"Image too small: {len(image_bytes)} bytes"}
    
    try:
        embedder = BioCLIPEmbedder()
        embedding = embedder.embed.remote(image_bytes)
        return {"embedding": embedding}
    except Exception as e:
        return {"error": f"Embedding failed: {str(e)}"}


# =============================================================================
# Full Pipeline
# =============================================================================

@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install("pillow"),
    timeout=600,
)
def process_image(image_bytes: bytes, prompt: str = "mouse body") -> dict:
    """
    Full pipeline: SAM3 segment → BioCLIP embed.
    
    Returns dict with cropped image bytes and embedding.
    """
    # Segment
    segmenter = SAM3Segmenter()
    cropped_bytes = segmenter.segment.remote(image_bytes, prompt)
    
    # Embed
    embedder = BioCLIPEmbedder()
    embedding = embedder.embed.remote(cropped_bytes)
    
    return {
        "cropped_image": cropped_bytes,
        "embedding": embedding,
    }


@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install("pillow"),
    timeout=1800,  # 30 min for batch
)
def process_batch(images_bytes: list, prompt: str = "mouse body") -> list:
    """Process multiple images through the pipeline."""
    results = []
    
    segmenter = SAM3Segmenter()
    embedder = BioCLIPEmbedder()
    
    for i, img_bytes in enumerate(images_bytes):
        print(f"Processing {i+1}/{len(images_bytes)}...")
        
        try:
            cropped = segmenter.segment.remote(img_bytes, prompt)
            embedding = embedder.embed.remote(cropped)
            results.append({
                "cropped_image": cropped,
                "embedding": embedding,
                "error": None,
            })
        except Exception as e:
            results.append({
                "cropped_image": None,
                "embedding": None,
                "error": str(e),
            })
    
    return results


# =============================================================================
# Evaluation Pipeline
# =============================================================================

@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install(
        "pillow", "numpy", "scikit-learn", "tqdm"
    ),
    timeout=3600,  # 1 hour for full eval
)
def run_evaluation(
    train_images: list,  # List of (image_bytes, label) tuples
    test_images: list,   # List of (image_bytes, label) tuples
    prompt: str = "mouse body",
) -> dict:
    """
    Run full evaluation pipeline on cloud.
    
    1. Segment all images with SAM3
    2. Generate BioCLIP embeddings
    3. Train classifier on train set
    4. Evaluate on test set
    
    Returns accuracy metrics.
    """
    from sklearn.metrics import accuracy_score, classification_report
    import numpy as np
    
    segmenter = SAM3Segmenter()
    embedder = BioCLIPEmbedder()
    classifier = EstrusClassifier()
    
    # Process training data
    print(f"Processing {len(train_images)} training images...")
    train_embeddings = []
    train_labels = []
    
    for i, (img_bytes, label) in enumerate(train_images):
        if i % 10 == 0:
            print(f"  Train {i+1}/{len(train_images)}")
        try:
            cropped = segmenter.segment.remote(img_bytes, prompt)
            emb = embedder.embed.remote(cropped)
            train_embeddings.append(emb)
            train_labels.append(label)
        except Exception as e:
            print(f"  ⚠️ Error on train {i}: {e}")
    
    # Train classifier
    print(f"Training classifier on {len(train_embeddings)} samples...")
    train_result = classifier.train.remote(train_embeddings, train_labels)
    print(f"  Train accuracy: {train_result['train_accuracy']:.4f}")
    
    # Process test data
    print(f"Processing {len(test_images)} test images...")
    test_embeddings = []
    test_labels = []
    
    for i, (img_bytes, label) in enumerate(test_images):
        if i % 10 == 0:
            print(f"  Test {i+1}/{len(test_images)}")
        try:
            cropped = segmenter.segment.remote(img_bytes, prompt)
            emb = embedder.embed.remote(cropped)
            test_embeddings.append(emb)
            test_labels.append(label)
        except Exception as e:
            print(f"  ⚠️ Error on test {i}: {e}")
    
    # Predict
    print("Running predictions...")
    predictions = classifier.predict_batch.remote(test_embeddings)
    
    pred_labels = [p["prediction"] for p in predictions]
    
    # Calculate metrics
    accuracy = accuracy_score(test_labels, pred_labels)
    report = classification_report(test_labels, pred_labels, output_dict=True)
    
    print(f"\n{'='*60}")
    print(f"EVALUATION RESULTS")
    print(f"{'='*60}")
    print(f"Test Accuracy: {accuracy:.4f} ({accuracy*100:.1f}%)")
    print(f"Train samples: {len(train_embeddings)}")
    print(f"Test samples: {len(test_embeddings)}")
    print(classification_report(test_labels, pred_labels))
    
    return {
        "accuracy": accuracy,
        "train_accuracy": train_result["train_accuracy"],
        "n_train": len(train_embeddings),
        "n_test": len(test_embeddings),
        "classification_report": report,
        "predictions": list(zip(test_labels, pred_labels)),
    }


# =============================================================================
# Comparison Evaluation (k-NN vs Linear, with/without crop)
# =============================================================================

@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install(
        "pillow", "numpy", "scikit-learn"
    ),
    timeout=7200,  # 2 hours for full comparison
)
def run_comparison_eval(
    train_images: list,  # List of (image_bytes, label) tuples
    test_images: list,
) -> dict:
    """
    Compare cropping methods with both k-NN and Linear classifiers.
    
    Tests:
    1. No crop
    2. OWLv2 crop
    3. SAM3 "mouse body" crop
    """
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import accuracy_score
    import numpy as np
    
    embedder = BioCLIPEmbedder()
    segmenter = SAM3Segmenter()
    owlv2 = OWLv2Detector()
    
    results = {}
    
    def evaluate_method(name, train_emb, train_labels, test_emb, test_labels):
        """Train and evaluate both classifiers."""
        X_train = np.array(train_emb)
        X_test = np.array(test_emb)
        le = LabelEncoder()
        y_train = le.fit_transform(train_labels)
        y_test = le.transform(test_labels)
        
        # k-NN
        knn = KNeighborsClassifier(n_neighbors=5, metric='cosine')
        knn.fit(X_train, y_train)
        knn_acc = accuracy_score(y_test, knn.predict(X_test))
        
        # Linear
        linear = LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced')
        linear.fit(X_train, y_train)
        linear_acc = accuracy_score(y_test, linear.predict(X_test))
        
        print(f"✅ {name}: k-NN={knn_acc*100:.1f}%, Linear={linear_acc*100:.1f}%")
        return {"knn_accuracy": knn_acc, "linear_accuracy": linear_acc}
    
    # =========================================================================
    # 1. No cropping - just embed raw images
    # =========================================================================
    print("\n" + "="*60)
    print("Method 1: No Crop (Raw Images)")
    print("="*60)
    
    print(f"Embedding {len(train_images)} training images...")
    raw_train_emb, raw_train_labels = [], []
    for i, (img_bytes, label) in enumerate(train_images):
        if i % 20 == 0:
            print(f"  Train {i}/{len(train_images)}")
        try:
            emb = embedder.embed.remote(img_bytes)
            raw_train_emb.append(emb)
            raw_train_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"Embedding {len(test_images)} test images...")
    raw_test_emb, raw_test_labels = [], []
    for i, (img_bytes, label) in enumerate(test_images):
        if i % 10 == 0:
            print(f"  Test {i}/{len(test_images)}")
        try:
            emb = embedder.embed.remote(img_bytes)
            raw_test_emb.append(emb)
            raw_test_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    results["No Crop"] = evaluate_method(
        "No Crop", raw_train_emb, raw_train_labels, raw_test_emb, raw_test_labels
    )
    
    # =========================================================================
    # 2. OWLv2 crop
    # =========================================================================
    print("\n" + "="*60)
    print("Method 2: OWLv2 Crop")
    print("="*60)
    
    print(f"Processing {len(train_images)} training images...")
    owlv2_train_emb, owlv2_train_labels = [], []
    for i, (img_bytes, label) in enumerate(train_images):
        if i % 20 == 0:
            print(f"  Train {i}/{len(train_images)}")
        try:
            cropped = owlv2.detect_and_crop.remote(img_bytes)
            emb = embedder.embed.remote(cropped)
            owlv2_train_emb.append(emb)
            owlv2_train_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"Processing {len(test_images)} test images...")
    owlv2_test_emb, owlv2_test_labels = [], []
    for i, (img_bytes, label) in enumerate(test_images):
        if i % 10 == 0:
            print(f"  Test {i}/{len(test_images)}")
        try:
            cropped = owlv2.detect_and_crop.remote(img_bytes)
            emb = embedder.embed.remote(cropped)
            owlv2_test_emb.append(emb)
            owlv2_test_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    results["OWLv2 Crop"] = evaluate_method(
        "OWLv2 Crop", owlv2_train_emb, owlv2_train_labels, owlv2_test_emb, owlv2_test_labels
    )
    
    # =========================================================================
    # 3. SAM3 "mouse body" crop
    # =========================================================================
    print("\n" + "="*60)
    print("Method 3: SAM3 'mouse body' Crop")
    print("="*60)
    
    print(f"Processing {len(train_images)} training images...")
    sam3_train_emb, sam3_train_labels = [], []
    for i, (img_bytes, label) in enumerate(train_images):
        if i % 20 == 0:
            print(f"  Train {i}/{len(train_images)}")
        try:
            cropped = segmenter.segment.remote(img_bytes, "mouse body")
            emb = embedder.embed.remote(cropped)
            sam3_train_emb.append(emb)
            sam3_train_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"Processing {len(test_images)} test images...")
    sam3_test_emb, sam3_test_labels = [], []
    for i, (img_bytes, label) in enumerate(test_images):
        if i % 10 == 0:
            print(f"  Test {i}/{len(test_images)}")
        try:
            cropped = segmenter.segment.remote(img_bytes, "mouse body")
            emb = embedder.embed.remote(cropped)
            sam3_test_emb.append(emb)
            sam3_test_labels.append(label)
        except Exception as e:
            print(f"  Error: {e}")
    
    results["SAM3 'mouse body'"] = evaluate_method(
        "SAM3 'mouse body'", sam3_train_emb, sam3_train_labels, sam3_test_emb, sam3_test_labels
    )
    
    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    for method, metrics in results.items():
        print(f"  {method:25s}: k-NN={metrics['knn_accuracy']*100:5.1f}%, Linear={metrics['linear_accuracy']*100:5.1f}%")
    
    return results


# =============================================================================
# Local entrypoint for testing
# =============================================================================

@app.local_entrypoint()
def main():
    """Test the pipeline."""
    from pathlib import Path
    
    print("=" * 60)
    print("Estrus Pipeline Test")
    print("=" * 60)
    
    test_image = Path("../dataset_raw/ESTRUS/AI11_1_EST.jpg")
    if test_image.exists():
        print(f"\n📷 Testing with {test_image.name}...")
        
        with open(test_image, "rb") as f:
            image_bytes = f.read()
        
        result = process_image.remote(image_bytes)
        
        print(f"✅ Cropped image: {len(result['cropped_image'])} bytes")
        print(f"✅ Embedding: {len(result['embedding'])} dimensions")
        
        # Save cropped image
        with open("test_pipeline_result.jpg", "wb") as f:
            f.write(result["cropped_image"])
        print(f"✅ Saved to test_pipeline_result.jpg")
    else:
        print(f"❌ Test image not found: {test_image}")
