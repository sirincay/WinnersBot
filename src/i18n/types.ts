export type SupportedLanguage = 'az' | 'ru' | 'en' | 'tr';

export interface TranslationStrings {
  // Naviqasiya və Ümumi
  mainMenu: string;
  gamesMenu: string;
  profile: string;
  orders: string;
  balance: string;
  services: string;
  support: string;
  reviews: string;
  faq: string;
  referral: string;
  promocode: string;
  language: string;
  back: string;
  home: string;
  cancel: string;
  confirm: string;
  refresh: string;
  navWebStore: string;

  // Əsas İdarəetmə Paneli
  welcomeHeader: string;
  welcomeSub: string;
  currentBalance: string;
  userProfileTitle: string;
  totalOrdersCount: string;
  totalSpent: string;

  // Profil və Sifariş Tarixçəsi
  profileRegDate: string;
  profileNewUser: string;
  noOrdersYet: string;
  orderStatusCompleted: string;
  orderStatusFailed: string;
  orderStatusProcessing: string;
  orderProduct: string;
  orderPlayerId: string;
  orderAmount: string;
  orderStatus: string;
  orderDate: string;

  // Oyunlar və Topup
  catalogTitle: string;
  catalogDesc: string;
  topupSectionTitle: string;
  topupSectionBtn: string;
  topupSectionDesc: string;
  giftcardSectionTitle: string;
  giftcardSectionBtn: string;
  giftcardSectionDesc: string;
  pubgTitle: string;
  pubgAutoDesc: string;
  pubgEpinDesc: string;
  pubgWebDesc: string;
  enterPlayerId: string;
  invalidPlayerId: string;
  orderConfirmTitle: string;
  orderDeliveredTitle: string;
  orderProcessing: string;
  orderForwardingOperator: string;
  orderAutoProcessing: string;
  searchGameBtn: string;
  insufficientBalance: string;

  // Ödənişlər
  paymentTitle: string;
  choosePaymentMethod: string;
  binanceTitle: string;
  binanceDesc: string;
  binanceEnterAmount: string;
  binanceWaitingTx: string;
  binanceSuccess: string;
  binanceExpired: string;
  m10Title: string;
  m10Desc: string;
  cardTitle: string;
  cardDesc: string;
  receiptSent: string;
  paymentInstantCryptoDesc: string;
  paymentBinanceOption: string;
  paymentTrc20Option: string;
  paymentBep20Option: string;
  paymentChooseCryptoMethod: string;
  paymentSelectAmount: string;
  paymentExchangeRate: string;
  paymentTypeAmountUsd: string;
  paymentTrc20Title: string;
  paymentBep20Title: string;
  paymentBinancePayTitle: string;
  paymentNetwork: string;
  paymentWalletAddress: string;
  paymentBinancePayId: string;
  paymentAmountToPay: string;
  paymentBalanceCredit: string;
  paymentSessionExpiry: string;
  paymentCryptoStep1: string;
  paymentCryptoStep2Trc: string;
  paymentCryptoStep2Bep: string;
  paymentCryptoStep3: string;
  paymentCryptoStep4: string;
  paymentCryptoExample: string;
  paymentBinanceStep1: string;
  paymentBinanceStep2: string;
  paymentBinanceStep3: string;
  paymentBinanceStep4: string;
  paymentBinanceExample: string;
  paymentSendTxIdPrompt: string;
  paymentBtnCancel: string;
  paymentBtnChangeAmount: string;
  paymentBtnTopupAgain: string;
  paymentOrderExpiredTitle: string;
  paymentOrderExpiredDesc: string;
  paymentCheckingWait: string;
  paymentAutoApprovedTitle: string;
  paymentAutoApprovedStatus: string;
  paymentAddedBalance: string;
  paymentNewBalance: string;
  paymentAutoApprovedNowShop: string;
  paymentReceivedTitle: string;
  paymentTxIdLabel: string;
  paymentStatusPending: string;
  paymentPendingAdminReview: string;
  paymentCancelledTitle: string;
  paymentCancelledDesc: string;

  // Rəylər və Reytinqlər
  ratingTitle: string;
  ratePrompt: string;
  rateThanks: string;
  writeCommentPrompt: string;
  commentSaved: string;
  reviewsOverallRating: string;
  reviewsCountLabel: string;
  reviewsRecentReviews: string;
  reviewsNoReviewsYet: string;
  reviewsAutoPromptNote: string;
  reviewsBtnOrderNow: string;
  reviewsBtnWriteComment: string;
  reviewsBtnAllReviews: string;
  reviewsThanksTitle: string;
  reviewsYouRated: string;
  reviewsWriteCommentDesc: string;

  // Dəvətlər (Referal)
  referralTitle: string;
  referralLinkText: string;
  referralStats: string;
  referralYourStats: string;
  referralInvitedFriends: string;
  referralEarnedCommission: string;
  referralCommissionExpl: string;
  referralBtnShare: string;

  // Promokod
  promocodeTitle: string;
  promocodePrompt: string;
  promocodeSuccess: string;
  promocodeInvalid: string;
  promocodeHeroDesc: string;
  promocodeEarnedAmount: string;
  promocodeInstantCredited: string;

  // Dəstək və Tez-tez Verilən Suallar
  supportTitle: string;
  supportSubtitle: string;
  supportWorkingHours: string;
  faqTitle: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqExtraQuestions: string;
  faqBtnContactSupport: string;

  // Mağaza və Kataloq Detalları
  outOfStock: string;
  lastStock: string;
  outOfStockAlert: string;
  more: string;
  choosePackage: string;
  noteWebPurchase: string;
  noteEpin: string;
  noteTopup: string;
  noOffersFound: string;
  pubgChooseType: string;
  pubgAutoInfo: string;
  pubgEpinInfo: string;
  pubgWebInfo: string;
  selectButtonBelow: string;
  selectGameToTopup: string;
  fieldGame: string;
  fieldPackage: string;
  fieldPlayerId: string;
  fieldAmountToPay: string;
  confirmPrompt: string;
  balanceInsufficientTitle: string;
  balanceMissing: string;
  topUpToProceed: string;
  btnDepositBalance: string;
  btnBackToPackages: string;
  btnCancelAndReturn: string;
  promptEnterPlayerId: string;
  promptTypePlayerId: string;
  invalidPlayerIdPrompt: string;

  // Bildirişlər və Çatdırılma
  notifOrderDeliveredTitle: string;
  notifStatusInstantDelivery: string;
  notifDigitalCodes: string;
  notifDigitalCodesInfo: string;
  notifThankYou: string;
  notifRateOurService: string;
  notifBtnWriteReview: string;
  notifBtnNewOrder: string;
  notifWebAcceptedTitle: string;
  notifWebAcceptedDesc: string;
  notifWebAcceptedStatus: string;
  notifWebAcceptedNote: string;
  notifWebCompletedTitle: string;
  notifWebCompletedDesc: string;
  notifWebCompletedStatus: string;
  notifWebCompletedCheckGame: string;
  notifOrderFailedTitle: string;
  notifOrderCancelledTitle: string;
  notifRefundedAmount: string;
  notifBalanceRefunded: string;
  notifCancelReason: string;
  notifCancelContactSupport: string;
  notifPaymentApprovedTitle: string;
  notifPaymentApprovedBody: string;
  notifPaymentRejectedTitle: string;
  notifPaymentRejectedBody: string;

  // B2B API Platforması
  b2bApiBtn: string;
  b2bApiTitle: string;
  b2bApiDocLink: string;
  b2bApiKeyLabel: string;
  b2bApiTapToCopy: string;
  b2bApiWarning: string;
  b2bApiRegenPrompt: string;
  b2bApiRegenWarning: string;
  b2bApiRegenBtn: string;
  b2bApiDocBtn: string;
}
