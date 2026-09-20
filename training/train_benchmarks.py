"""Benchmarking training script for candidate plant disease classification architectures.

Supports training and evaluating:
    - EfficientNet-B0
    - ResNet-50
    - MobileNetV3-Large
    - DenseNet-121

Usage:
    python training/train_benchmarks.py --model resnet50 --epochs 5
    python training/train_benchmarks.py --model mobilenet_v3_large --epochs 5
    python training/train_benchmarks.py --model densenet121 --epochs 5
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau

from config.config import TrainingConfig
from data.data_loader import create_data_loaders
from data.dataset_splitter import prepare_dataset
from evaluation.evaluator import evaluate_test_set
from models.multi_model_factory import build_model
from utils.logger import setup_logger

logger = logging.getLogger("training.train_benchmarks")


def train_candidate_model(
    model_name: str,
    epochs: int = 5,
    batch_size: int = 32,
    lr: float = 1e-4,
) -> dict:
    """Trains and evaluates a candidate model architecture on the PlantVillage dataset.

    Args:
        model_name: Candidate model architecture key.
        epochs: Number of training epochs.
        batch_size: Batch size.
        lr: Learning rate.

    Returns:
        dict: Evaluation metrics on the test split.
    """
    config = TrainingConfig()
    config.create_directories()
    config.BATCH_SIZE = batch_size

    log = setup_logger(config.LOGS_DIR, name=f"train_{model_name}")
    log.info("Preparing dataset for %s training...", model_name)

    prepare_dataset(config)
    train_loader, val_loader, test_loader, class_names = create_data_loaders(config)

    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    log.info("Using device: %s for training %s", device, model_name)

    model = build_model(model_name=model_name, num_classes=len(class_names), pretrained=True)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    best_val_acc = 0.0
    checkpoint_path = config.MODELS_DIR / f"{model_name}_best.pth"

    log.info("Starting %d epochs of training for %s...", epochs, model_name)
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        train_acc = correct / max(1, total)

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        val_acc = val_correct / max(1, val_total)
        scheduler.step(val_acc)

        log.info(
            "Epoch [%d/%d] - Train Acc: %.2f%% | Val Acc: %.2f%%",
            epoch, epochs, train_acc * 100, val_acc * 100
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), checkpoint_path)
            log.info("Saved new best checkpoint to %s", checkpoint_path)

    elapsed = time.time() - start_time
    log.info("Training complete in %.1f seconds. Evaluating on test holdout...", elapsed)

    if checkpoint_path.exists():
        model.load_state_dict(torch.load(checkpoint_path, map_location=device))

    test_metrics = evaluate_test_set(
        model=model,
        test_loader=test_loader,
        class_names=class_names,
        device=device,
        output_dir=config.REPORTS_DIR,
    )

    log.info(
        "Final %s Test Results - Accuracy: %.2f%% | Macro F1: %.2f%%",
        model_name, test_metrics.get("accuracy", 0.0) * 100, test_metrics.get("macro_f1", 0.0) * 100
    )

    return test_metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train candidate benchmark models")
    parser.add_argument(
        "--model",
        type=str,
        default="resnet50",
        choices=["efficientnet_b0", "resnet50", "mobilenet_v3_large", "densenet121"],
        help="Architecture to train",
    )
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")

    args = parser.parse_args()
    train_candidate_model(
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )
