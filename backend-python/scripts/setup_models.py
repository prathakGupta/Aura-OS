import os
import urllib.request
import argparse

# Pre-configured model links. If using Google Drive, replace the direct link with the gdown logic
# For AWS S3 or HuggingFace, a direct download link is usually standard.
MODELS = {
    "wav2vec2_emotion.pt": {
        "url": "https://example-placeholder-url.com/models/wav2vec2_emotion.pt",
        "description": "Deep learning model for high-fidelity audio inference (378 MB)",
        "required": True
    }
}

def download_file(url: str, output_path: str):
    """Downloads a file and shows a basic progress indicator."""
    print(f"Downloading from {url}...")
    try:
        # A simple progress hook
        def show_progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                percent = downloaded * 100 / total_size
                # Avoid printing too many lines
                if int(percent) % 10 == 0:
                    print(f"   {int(percent)}% completed ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)", end='\r')

        urllib.request.urlretrieve(url, output_path, reporthook=show_progress)
        print("\nDownload finished.")
        return True
    except Exception as e:
        print(f"\n[ERROR] Failed to download {url}")
        print(f"Reason: {e}")
        return False

def setup_models():
    """Main workflow to ensure models exist in the repository."""
    # Find the backend-python/models directory dynamically
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.abspath(os.path.join(current_dir, "..", "models"))
    
    if not os.path.exists(models_dir):
         os.makedirs(models_dir, exist_ok=True)
         print(f"Created directory: {models_dir}")

    all_success = True

    for model_name, info in MODELS.items():
        model_path = os.path.join(models_dir, model_name)
        if os.path.exists(model_path):
            print(f"[*] {model_name} already exists. Skipping.")
            continue
        
        print(f"\n[!] Missing model: {model_name}")
        print(f"Description: {info['description']}")
        
        if "example-placeholder-url" in info["url"]:
            print(f"[WARN] Placeholder URL detected for {model_name}. You must edit 'backend-python/scripts/setup_models.py' and provide a real URL (e.g., from AWS S3, Google Drive, or HuggingFace) before this script will work.")
            all_success = False
            continue

        success = download_file(info["url"], model_path)
        if not success:
            all_success = False

    print("\n--- Summary ---")
    if all_success:
        print("✅ All required ML models are ready.")
        print("You can safely start the backend (the models will not silently fallback to heuristics).")
    else:
        print("❌ Some models are missing or failed to download.")
        print("The backend will run, but it will fallback to heuristic (lower accuracy) mode.")

if __name__ == "__main__":
    setup_models()
