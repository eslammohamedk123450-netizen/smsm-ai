import 'package:flutter/material.dart';

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
  final String routingGroup;
  final List<String> allowedTiers;

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
    this.routingGroup = 'free_race',
    this.allowedTiers = const ['free', 'lite', 'pro', 'max'],
  });

  bool get isFree => routingGroup == 'free_race' || category == 'free';
  bool get isPremium => routingGroup == 'paid_fallback' || category == 'premium';
  bool get isActive => status == 'active';
  bool get isRacing => isRacingEnabled && isFree;

  String get badgeLabel {
    if (routingGroup == 'free_race') return 'FREE RACE';
    if (routingGroup == 'paid_fallback') return 'PAID FALLBACK';
    return 'DISABLED';
  }

  Color get badgeColor {
    if (routingGroup == 'free_race') return const Color(0xFF10B981);
    if (routingGroup == 'paid_fallback') return const Color(0xFF8B5CF6);
    return const Color(0xFF6B7280);
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
    String? routingGroup,
    List<String>? allowedTiers,
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
      routingGroup: routingGroup ?? this.routingGroup,
      allowedTiers: allowedTiers ?? this.allowedTiers,
    );
  }
}
