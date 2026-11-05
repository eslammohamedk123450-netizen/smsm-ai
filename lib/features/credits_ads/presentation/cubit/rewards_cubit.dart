import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../core/services/credit_service.dart';

abstract class RewardsState extends Equatable {
  const RewardsState();
  @override
  List<Object?> get props => [];
}

class RewardsInitial extends RewardsState {
  const RewardsInitial();
}

class RewardsLoading extends RewardsState {
  const RewardsLoading();
}

class RewardsLoaded extends RewardsState {
  final int credits;
  const RewardsLoaded(this.credits);
  @override
  List<Object?> get props => [credits];
}

class RewardsError extends RewardsState {
  final String message;
  const RewardsError(this.message);
  @override
  List<Object?> get props => [message];
}

class RewardAdded extends RewardsState {
  final int amount;
  final int newBalance;
  const RewardAdded(this.amount, this.newBalance);
  @override
  List<Object?> get props => [amount, newBalance];
}

class RewardsCubit extends Cubit<RewardsState> {
  final CreditService _creditService;
  String _userId = '';

  RewardsCubit(this._creditService);

  void setUserId(String userId) => _userId = userId;

  Future<void> loadCredits() async {
    emit(const RewardsLoading());
    try {
      final credits = await _creditService.getCredits(_userId);
      emit(RewardsLoaded(credits));
    } catch (e) {
      emit(RewardsError(e.toString()));
    }
  }

  Future<void> addCreditsFromAd(int bonusAmount) async {
    if (_userId.isEmpty) {
      emit(const RewardsError('User not authenticated'));
      return;
    }
    try {
      final result = await _creditService.addCredits(
        userId: _userId,
        amount: bonusAmount,
        source: 'rewarded_ad',
      );
      final newBalance = (result['new_balance'] as num?)?.toInt() ?? 0;
      emit(RewardAdded(bonusAmount, newBalance));
    } catch (e) {
      emit(RewardsError(e.toString()));
    }
  }

  Future<void> deductCredits(int totalTokens, int cost, String source) async {
    try {
      await _creditService.deductCredits(
        userId: _userId,
        totalTokens: totalTokens,
        cost: cost,
        source: source,
      );
      await loadCredits();
    } catch (e) {
      emit(RewardsError(e.toString()));
    }
  }
}

import 'package:equatable/equatable.dart';