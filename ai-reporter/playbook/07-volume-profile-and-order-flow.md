# Volume Profile & Order Flow Rules
Source: Voluma Trading — Volume Profile Guide, Order Flow Guide, Market Profile Guide

## Core Principle
Price shows WHAT happened. Volume explains WHY it happened and WHERE it mattered most. Order flow reveals the actual buy and sell orders creating price action in real time. These tools confirm or challenge what price action alone suggests. Volume Profile shows the price levels where the most trading occurred — the "accepted" zones. Market Profile adds time. Together they reveal institutional positioning invisible to candle readers alone.

---

## Rules

### 1. Point of Control (POC) = price magnet
- The Point of Control is the price level where the highest volume traded over a given period
- POC represents the "fairest" price in the recent memory of the market — both buyers and sellers found the most agreement here
- Price tends to return to the POC when it moves away from it (like a rubber band)
- A POC above current price = bullish magnet pulling price upward
- A POC below current price = bearish magnet pulling price downward
- Application: If price is significantly below a major POC and system says BUY → the POC provides additional bullish pull. aiConfidenceAdjustment +1.

### 2. Value Area High (VAH) and Value Area Low (VAL)
- The Value Area represents the price range where 70% of all volume traded occurred
- VAH = top of this range; VAL = bottom of this range
- Price above VAH = price is in a "high value" zone for sellers — rejected premium
- Price below VAL = price is in a "low value" zone for buyers — accepted discount
- When price returns INTO the value area from outside, it tends to travel toward the POC
- When price is accepted OUTSIDE the value area (trading there for multiple sessions), this signals a new value discovery = trend beginning

### 3. Low Volume Nodes (LVN) = price moves fast through these
- A Low Volume Node is a price range with very little historical trading activity
- Price moves quickly through LVNs because there are few limit orders to slow it down
- An LVN above current price = if price reaches it, it will likely accelerate through it (bullish breakout fuel)
- An LVN below current price = if price reaches it, it will likely fall through it quickly (bearish breakdown acceleration)
- Application: A BUY signal where there is a large LVN between current price and the target = the target is more achievable. aiConfidenceAdjustment +1.

### 4. High Volume Nodes (HVN) = price consolidates and reverses here
- HVNs are price levels with very high historical trading activity
- Price slows down at HVNs and often reverses or consolidates here
- An HVN above current price = strong resistance — price will struggle to push through
- An HVN below current price = strong support — price will find buyers here
- Application: If a system BUY target coincides with a major HVN overhead → price may get stuck or reverse at that level. Reduce target expectations or mark MODIFIED.

### 5. Volume cluster breakouts
- When price breaks out of a consolidation zone (HVN cluster) with high volume → breakout is confirmed as institutional, likely to continue
- When price breaks out of a consolidation zone with LOW volume → false breakout likely, high probability of reversal back into the range
- Application: If a pair broke out of a multi-week range recently, assess volume: high volume breakout = continue in breakout direction; low volume breakout = skeptical, wait for retest.

### 6. Auction Market Theory — acceptance vs rejection
- Markets alternate between two states: ACCEPTANCE (trading at a price level for extended time = value found) and REJECTION (quickly leaving a price level = no value there)
- Areas of acceptance = high volume, more time spent → SUPPORT / RESISTANCE that actually matters
- Areas of rejection = low volume, fast pass-through → no meaningful support or resistance
- The market is always searching for the next area of acceptance. Imbalanced markets (trending) are seeking a new value area.
- Application: When evaluating whether a "support" level matters for a pair, ask: was this an area of acceptance (high volume, time spent) or just a price tag that was briefly touched?

### 7. Delta / Order Flow imbalance
- Delta measures the difference between buying volume and selling volume at a price level
- Positive delta = more aggressive buying (market orders buying) than selling at that level
- Negative delta = more aggressive selling (market orders selling) than buying
- When price is rising but delta is declining (selling pressure increasing into the rally) → momentum divergence, potential reversal
- When price is falling but delta is increasing (buying pressure increasing into the decline) → potential reversal to upside
- Application: If you have access to COT data showing net institutional buying (positive delta equivalent) while price is falling → divergence, likely support. Upgrade SELL signal with caution.

### 8. Initiative vs responsive activity
- **Initiative activity**: Aggressive buying above VAH or aggressive selling below VAL → institutions are starting a new directional move (trend)
- **Responsive activity**: Buying below VAL or selling above VAH → institutions are trading back toward fair value (mean reversion)
- Trading with initiative activity = trend trading (higher momentum, wider stops needed)
- Trading with responsive activity = counter-trend or range trading (more precise, tighter stops)
- Application: A system BUY signal with price below VAL = responsive activity (mean reversion back to fair value). Lower confidence than a BUY with initiative activity (price breaking above VAH).

### 9. Market Profile — time at price matters
- If a pair has spent multiple sessions at a price level → that is genuine acceptance, the level is important
- If a pair quickly passed through a level in a single session → no acceptance, the level means little
- D-shaped profile (symmetric bell curve) = balanced, range-bound market. Trade the extremes (VAH short, VAL long).
- P-shaped profile (heavy top) = bullish activity, price accepted higher and came back. Bullish bias.
- b-shaped profile (heavy bottom) = bearish activity, price accepted lower and came back. Bearish bias.

---

## How to apply to MacroTrade pairs

- If pair is trading below its weekly POC → bullish pull toward POC, supports BUY signal if structure agrees; aiConfidenceAdjustment +1
- If pair is trading above its weekly POC → bearish pull toward POC, supports SELL signal if structure agrees; aiConfidenceAdjustment +1
- A system BUY signal when pair is below VAL (discount zone) → responsive buyers active, supports BUY; aiConfidenceAdjustment +1
- A system SELL signal when pair is above VAH (premium zone) → responsive sellers active, supports SELL; aiConfidenceAdjustment +1
- When system direction conflicts with where price is relative to value area → reduce confidence -1
- If recent news drove a high-volume breakout out of the value area → trend initiation signal. If low-volume breakout → skeptical, MODIFIED verdict.
