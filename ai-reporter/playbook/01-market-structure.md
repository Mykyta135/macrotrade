# Market Structure Rules
Source: jeaFX Bootcamp (Episodes 1-2, 12) + Voluma Trading Market Structure Guide

## Core Principle
Market structure is the most important lens for determining trade direction. Read the real high/low structure printed by candles — not indicators, trend lines, or patterns. Every candle body represents confirmed price action; every wick represents rejected price action.

---

## Rules

### 1. Trade only in confirmed trend direction
- **Uptrend** = consistent higher highs (HH) + higher lows (HL) confirmed by candle body closures → only look for BUY setups
- **Downtrend** = consistent lower lows (LL) + lower highs (LH) confirmed by candle body closures → only look for SELL setups
- **Consolidation / unclear structure** = no trade. Do not get chopped trying to guess direction.
- Application: If the system gives a BUY on a pair in clear downtrend (LL/LH structure on daily/4H), apply aiVerdict REJECTED or MODIFIED and reduce confidence by -1 or -2.

### 2. Break of Structure (BOS) validates trend continuation
- A BOS occurs when price closes (candle body, not just wick) through a previous structural high or low.
- Bullish BOS = new higher high confirmed by body closure → confirms continuation up, look to buy pullbacks
- Bearish BOS = new lower low confirmed by body closure → confirms continuation down, look to sell rallies
- A wick through a structural level does NOT count as a valid BOS. Wicks show rejection, not confirmation.

### 3. Reversal requires a structural break, not just a bounce
- In an uptrend, reversal is only confirmed when price closes BELOW the most recent higher low → creates a lower low → trend has shifted
- In a downtrend, reversal only confirmed when price closes ABOVE the most recent lower high → creates a higher high → trend has shifted
- Do not call a reversal from a wick, a bounce, or internal structure chop alone.

### 4. Distinguish impulse moves from corrective moves
- **Impulse move**: pro-trend move that creates a BOS (breaks through a structural high or low). These set direction.
- **Corrective move**: counter-trend pullback that stays within the range of the impulse (does not break a notable high or low). These are normal and expected.
- NEVER trade internal structure moves as if they signal a trend reversal. A corrective pullback can look like lower lows on a smaller timeframe — this is a trap. The larger impulse structure is what matters.

### 5. Internal structure trap (common mistake)
- When price is in an established trend, the pullback phase will often create small internal BOS moves in the opposite direction.
- These internal breaks DO NOT signal trend reversal. They are simply corrective chop.
- Only a BOS that closes THROUGH the major structural high (in a downtrend) or major structural low (in an uptrend) changes the trend.
- Application: If a pair shows an internal counter-trend BOS within what is still a valid corrective move, do NOT upgrade a SELL signal to BUY. Mark aiVerdict WATCH if unclear, or maintain direction if larger structure is intact.

### 6. Change of Character (CHoCH) as early reversal signal
- A CHoCH is the first structural sign that a trend may be losing momentum. It occurs when:
  - In a downtrend: price makes a higher high above the most recent lower high (but hasn't yet created a confirmed higher low)
  - In an uptrend: price makes a lower low below the most recent higher low (but hasn't yet created a confirmed lower high)
- CHoCH is an early warning, not a confirmed reversal. Treat as WATCH, not a trade trigger on its own.

### 7. Higher timeframe structure overrides lower timeframe signals
- Always establish structure on Daily and 4H before taking signals from 1H or 15M.
- If Daily shows a clear downtrend and the 1H shows a bullish BOS, the 1H BOS is likely internal structure corrective movement.
- Macro/system signals should be filtered through HTF structure first.

### 8. Valid pullback criteria for entries
A pullback is tradeable only when:
1. It occurs within an established trend (HTF structure intact)
2. Price shows deceleration as it approaches the demand/supply zone (smaller candles, wicks into zone)
3. Price shows signs of resumption in trend direction (strong candle in trend direction emerging from zone)
4. The pullback approaches a zone of interest (demand zone in uptrend, supply zone in downtrend)

---

## How to apply to MacroTrade pairs

- Before confirming or rejecting any system signal, check if the pair has a clear HH/HL (bullish) or LL/LH (bearish) structure on the daily chart.
- If the system says BUY but the pair is printing LL/LH on daily → aiVerdict MODIFIED at minimum, likely REJECTED. Reduce confidence by -1 or -2.
- If the system says SELL but the pair just made a major bullish BOS on daily (closed above recent LH creating a HH) → aiVerdict MODIFIED, reduce confidence -1.
- If the pair is in consolidation (no clear structure) → aiVerdict WATCH regardless of system grade, reduce confidence -1.
- If structure confirms system direction perfectly (e.g., pair in clear uptrend + system says BUY) → aiConfidenceAdjustment +1.
