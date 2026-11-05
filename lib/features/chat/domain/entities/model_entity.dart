class ModelEntity {
  final String id;
  final String provider;
  final String modelName;
  final String displayName;
  final String category;
  final String status;
  final int costPer1kTokens;
  final double creditMultiplier;
  final int maxTokens;
  final bool supportsStreaming;
  final bool isRacingEnabled;

  const ModelEntity({
    required this.id,
    required this.provider,
    required this.modelName,
    required this.displayName,
    required this.category,
    required this.status,
    required this.costPer1kTokens,
    required this.creditMultiplier,
    required this.maxTokens,
    required this.supportsStreaming,
    required this.isRacingEnabled,
  });

  bool get isFree => category == 'free';
  bool get isPremium => category == 'premium';
  bool get isActive => status == 'active';
  bool get isRacing => isRacingEnabled && isFree;

  String get badgeLabel {
    if (isRacing) return 'FREE - FAST RACING';
    if (isFree) return 'FREE';
    return 'PREMIUM - $costPer1kTokens CREDITS/1K';
  }

  Color get badgeColor {
    if (isRacing) return const Color(0xFF22D3EE);
    if (isFree) return const Color(0xFF10B981);
    return const Color(0xFF8B5CF6);
  }

  ModelEntity copyWith({
    String? id,
    String? provider,
    String? modelName,
    String? displayName,
    String? category,
    String? status,
    int? costPer1kTokens,
    double? creditMultiplier,
    int? maxTokens,
    bool? supportsStreaming,
    bool? isRacingEnabled,
  }) {
    return ModelEntity(
      id: id ?? this.id,
      provider: provider ?? this.provider,
      modelName: modelName ?? this.modelName,
      displayName: displayName ?? this.displayName,
      category: category ?? this.category,
      status: status ?? this.status,
      costPer1kTokens: costPer1kTokens ?? this.costPer1kTokens,
      creditMultiplier: creditMultiplier ?? this.creditMultiplier,
      maxTokens: maxTokens ?? this.maxTokens,
      supportsStreaming: supportsStreaming ?? this.supportsStreaming,
      isRacingEnabled: isRacingEnabled ?? this.isRacingEnabled,
    );
  }
}

import 'package:flutter/material.dart';