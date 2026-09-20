// Illustrative comparison fixtures, NOT measured history. Current dataset totals are never edited.
export const decisionHistory = {
  declining:{purchaseFactor:1.25,checkoutRate:.7},
  improving:{purchaseFactor:.8,checkoutRate:.45},
  // Prior equal-period response rates (%) in an explicitly synthetic, stationary campaign scenario.
  campaign:{
    "checkout-7d":{frequency:2.1,ctr:5.5,cvr:22},
    "cart-14d":{frequency:3.2,ctr:2.5,cvr:8},
    "view-30d":{frequency:3.8,ctr:2.5,cvr:5},
  },
} as const;
