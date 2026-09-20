"""Multi-architecture model factory for Plant Disease Detection benchmarks.

Provides unified construction, two-stage transfer learning interfaces, and
Grad-CAM target layer resolution for:
    1. EfficientNet-B0 (Production Backbone)
    2. ResNet-50
    3. MobileNetV3-Large
    4. DenseNet-121
"""

import logging

import torch
import torch.nn as nn
from torchvision.models import (
    DenseNet121_Weights,
    MobileNet_V3_Large_Weights,
    ResNet50_Weights,
    densenet121,
    mobilenet_v3_large,
    resnet50,
)

from models.efficientnet import EfficientNetB0PlantClassifier

logger = logging.getLogger("models.multi_model_factory")


class ResNet50PlantClassifier(nn.Module):
    """ResNet-50 model with custom classifier head and two-stage transfer learning."""

    def __init__(self, num_classes: int = 15, pretrained: bool = True) -> None:
        super().__init__()
        weights = ResNet50_Weights.DEFAULT if pretrained else None
        self.base_model = resnet50(weights=weights)
        in_features = self.base_model.fc.in_features
        self.base_model.fc = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes),
        )

    def freeze_backbone(self) -> None:
        """Freeze all layers except final classification layer."""
        for param in self.base_model.parameters():
            param.requires_grad = False
        for param in self.base_model.fc.parameters():
            param.requires_grad = True

    def unfreeze_final_blocks(self) -> None:
        """Unfreeze layer4 and classifier for fine-tuning."""
        for param in self.base_model.layer4.parameters():
            param.requires_grad = True
        for param in self.base_model.fc.parameters():
            param.requires_grad = True

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.base_model(x)

    def get_target_layer_for_gradcam(self) -> nn.Module:
        return self.base_model.layer4[-1]


class MobileNetV3PlantClassifier(nn.Module):
    """MobileNetV3-Large model with custom classifier head."""

    def __init__(self, num_classes: int = 15, pretrained: bool = True) -> None:
        super().__init__()
        weights = MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        self.base_model = mobilenet_v3_large(weights=weights)
        in_features = self.base_model.classifier[0].in_features
        self.base_model.classifier = nn.Sequential(
            nn.Linear(in_features, 1024),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(1024, num_classes),
        )

    def freeze_backbone(self) -> None:
        for param in self.base_model.features.parameters():
            param.requires_grad = False
        for param in self.base_model.classifier.parameters():
            param.requires_grad = True

    def unfreeze_final_blocks(self) -> None:
        for param in self.base_model.features[-3:].parameters():
            param.requires_grad = True
        for param in self.base_model.classifier.parameters():
            param.requires_grad = True

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.base_model(x)

    def get_target_layer_for_gradcam(self) -> nn.Module:
        return self.base_model.features[-1]


class DenseNet121PlantClassifier(nn.Module):
    """DenseNet-121 model with custom classifier head."""

    def __init__(self, num_classes: int = 15, pretrained: bool = True) -> None:
        super().__init__()
        weights = DenseNet121_Weights.DEFAULT if pretrained else None
        self.base_model = densenet121(weights=weights)
        in_features = self.base_model.classifier.in_features
        self.base_model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes),
        )

    def freeze_backbone(self) -> None:
        for param in self.base_model.features.parameters():
            param.requires_grad = False
        for param in self.base_model.classifier.parameters():
            param.requires_grad = True

    def unfreeze_final_blocks(self) -> None:
        for param in self.base_model.features.denseblock4.parameters():
            param.requires_grad = True
        for param in self.base_model.features.norm5.parameters():
            param.requires_grad = True
        for param in self.base_model.classifier.parameters():
            param.requires_grad = True

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.base_model(x)

    def get_target_layer_for_gradcam(self) -> nn.Module:
        return self.base_model.features.denseblock4


def build_model(
    model_name: str,
    num_classes: int = 15,
    pretrained: bool = True,
) -> nn.Module:
    """Instantiates a candidate architecture with custom classifier head.

    Args:
        model_name: One of 'efficientnet_b0', 'resnet50', 'mobilenet_v3_large', 'densenet121'.
        num_classes: Number of target agricultural disease classes.
        pretrained: Whether to load ImageNet pre-trained weights.

    Returns:
        nn.Module: Configured PyTorch model instance.
    """
    normalized = model_name.lower().replace("-", "_")

    if "efficientnet" in normalized:
        return EfficientNetB0PlantClassifier(num_classes=num_classes, pretrained=pretrained)
    elif "resnet" in normalized:
        return ResNet50PlantClassifier(num_classes=num_classes, pretrained=pretrained)
    elif "mobilenet" in normalized:
        return MobileNetV3PlantClassifier(num_classes=num_classes, pretrained=pretrained)
    elif "densenet" in normalized:
        return DenseNet121PlantClassifier(num_classes=num_classes, pretrained=pretrained)
    else:
        raise ValueError(
            f"Unsupported architecture '{model_name}'. "
            f"Supported: ['efficientnet_b0', 'resnet50', 'mobilenet_v3_large', 'densenet121']"
        )
