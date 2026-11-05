import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';

class AdMobService {
  static final AdMobService _instance = AdMobService._internal();
  factory AdMobService() => _instance;
  AdMobService._internal();

  RewardedAd? _rewardedAd;
  bool _isAdLoaded = false;
  bool _isInitializing = false;

  bool get isAdLoaded => _isAdLoaded;

  Future<void> initialize() async {
    if (_isInitializing) return;
    _isInitializing = true;

    try {
      await MobileAds.instance.initialize();
    } finally {
      _isInitializing = false;
    }
  }

  Future<void> loadRewardedAd({Function()? onAdLoaded, Function(String error)? onAdFailed}) async {
    _rewardedAd?.dispose();

    RewardedAd.load(
      adUnitId: AppConfig.admobRewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedAd = ad;
          _isAdLoaded = true;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              _isAdLoaded = false;
              ad.dispose();
              _rewardedAd = null;
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _isAdLoaded = false;
              ad.dispose();
              _rewardedAd = null;
              onAdFailed?.call(error.message);
            },
          );
          onAdLoaded?.call();
        },
        onAdFailedToLoad: (ad, error) {
          _isAdLoaded = false;
          _rewardedAd = null;
          onAdFailed?.call(error.message);
        },
      ),
    );
  }

  Future<void> showRewardedAd({
    required Function() onUserEarnedReward,
    required Function(String error) onAdFailed,
    Function()? onAdClosed,
  }) async {
    if (_rewardedAd == null || !_isAdLoaded) {
      await loadRewardedAd();
    }

    if (_rewardedAd == null) {
      onAdFailed.call('No rewarded ad available');
      return;
    }

    await _rewardedAd!.show(
      onUserEarnedReward: (ad, reward) {
        onUserEarnedReward.call();
      },
    );
  }

  void dispose() {
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _isAdLoaded = false;
  }
}
