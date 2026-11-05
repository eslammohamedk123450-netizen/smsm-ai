import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/rewards_cubit.dart';
import '../../../../core/theme/app_theme.dart';

class RewardedAdButton extends StatelessWidget {
  final int bonusAmount;
  final VoidCallback? onRewardEarned;

  const RewardedAdButton({
    super.key,
    this.bonusAmount = 50,
    this.onRewardEarned,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<RewardsCubit, RewardsState>(
      builder: (context, state) {
        final isProcessing = state is RewardsLoading || state is RewardAdded;
        return ElevatedButton.icon(
          onPressed: isProcessing ? null : () => _watchAd(context),
          icon: const Icon(Icons.play_circle, color: Colors.white),
          label: isProcessing
              ? const Text('Watching...')
              : const Text('Watch Ad & Earn Credits'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      },
    );
  }

  Future<void> _watchAd(BuildContext context) async {
    final cubit = context.read<RewardsCubit>();
    try {
      cubit.addCreditsFromAd(bonusAmount);
      onRewardEarned?.call();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ad failed: $e'), backgroundColor: AppColors.error),
      );
    }
  }
}
