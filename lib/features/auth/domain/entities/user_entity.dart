class UserEntity {
  final String id;
  final String email;
  final String? fullName;
  final String? avatarUrl;
  final String role;
  final bool isBanned;
  final int creditBalance;
  final String subscriptionTier;

  const UserEntity({
    required this.id,
    required this.email,
    this.fullName,
    this.avatarUrl,
    required this.role,
    required this.isBanned,
    required this.creditBalance,
    required this.subscriptionTier,
  });

  bool get isAdmin => role == 'admin';
  bool get canChat => !isBanned && creditBalance > 0;

  UserEntity copyWith({
    String? id,
    String? email,
    String? fullName,
    String? avatarUrl,
    String? role,
    bool? isBanned,
    int? creditBalance,
    String? subscriptionTier,
  }) {
    return UserEntity(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      role: role ?? this.role,
      isBanned: isBanned ?? this.isBanned,
      creditBalance: creditBalance ?? this.creditBalance,
      subscriptionTier: subscriptionTier ?? this.subscriptionTier,
    );
  }

  @override
  String toString() {
    return 'UserEntity(id: $id, email: $email, role: $role, credits: $creditBalance)';
  }
}
