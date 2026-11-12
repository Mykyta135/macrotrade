# Supply, Demand & Imbalance Rules
Source: jeaFX Bootcamp (Episodes 3, 4, 5) + Voluma Trading Supply & Demand Guide

## Core Principle
Supply and demand is the actual mechanism driving all market price movement. A supply zone is where large sellers are positioned; a demand zone is where large buyers are positioned. Imbalances (open price gaps between where price moved from and where it is now) act as magnetic price areas the market is likely to revisit.

---

## Rules

### 1. Demand zone = high-probability BUY area; Supply zone = high-probability SELL area
- A demand zone forms at the origin of a strong bullish move: the range of candles just before a sharp upward impulse
- A supply zone forms at the origin of a strong bearish move: the range of candles just before a sharp downward impulse
- These zones represent where institutional orders were placed and often remain unfilled
- Entry into a demand zone from above = potential buy. Entry into a supply zone from below = potential sell.

### 2. Do not buy into supply; do not sell into demand
- Never initiate a buy trade directly into a supply zone — this is a wall of sell orders overhead
- Never initiate a sell trade directly into a demand zone — this is a floor of buy orders below
- Application: If the system says BUY but price is currently sitting in a major supply zone on the 4H or daily, do not confirm. Apply aiVerdict MODIFIED and reduce confidence -1. If price is pressing against a major supply zone, REJECTED may be appropriate.

### 3. Imbalances act as magnets (price will revisit them)
- An imbalance is the open price range between a supply/demand zone and where price currently trades — it represents unfilled orders
- Markets tend to retrace to fill these imbalances before continuing in the trend direction
- An unfilled imbalance ABOVE current price = likely near-term bullish magnet
- An unfilled imbalance BELOW current price = likely near-term bearish magnet
- Do not enter a trade in a direction that has a major unfilled imbalance blocking it: the market is likely to visit that imbalance first

### 4. Efficient price ranges must be filled before entry
- If price has just made a sharp impulsive move (e.g., a 200-pip EUR/USD drop in one session), the imbalance created between the departure zone and current price must typically be revisited (partially or fully) before a clean continuation entry is valid
- Trading immediately after a large impulse with no retracement is a low-probability entry — wait for the fill

### 5. Quality supply/demand zone identification criteria
A valid zone must be:
- **Origin of a strong impulse**: price left this zone quickly with momentum (large candles, little wick)
- **Fresh**: not yet retested (once a zone is entered and price spends time there, it's consumed and no longer valid)
- **At a structural level**: ideally at a structural high (supply) or structural low (demand) confirmed by the HTF structure

### 6. Institutional supply/demand vs retail support/resistance
- Retail support and resistance are simple horizontal lines that everyone can see — they attract liquidity but are NOT the same as a true supply/demand zone
- A supply zone is the specific candle range where the aggressive sell orders originated
- Drawing lines at highs and lows without identifying the zone origin creates poor entries
- Application: When analyzing pair fundamentals, favor the presence of a true S/D zone over a generic round number or trendline as a directional filter

### 7. Zone strength increases with distance of departure
- The stronger and faster the move that originated from a zone, the more likely the zone holds on retest
- A zone that launched a 500-pip trend move has more unfilled orders than one that launched a 50-pip move
- Prefer zones that created sustained trend moves over zones from minor local swings

### 8. When price enters a demand zone from above (in uptrend)
- This is the primary BUY entry window — not at highs, not at the open of a new session, but on pullback INTO the demand zone
- Wait for confirmation: a strong bullish candle body closing within or above the zone (not just a wick)
- Application: If system says BUY and price is currently pulling back INTO a known demand zone with structure still intact → aiConfidenceAdjustment +1 or +2

### 9. Gap fills / Fair Value Gaps (FVG)
- A three-candle pattern where the middle candle moves so aggressively that there is a gap between the wick of candle 1 and the wick of candle 3
- This gap = imbalance = high-probability price return area
- FVGs form during strong institutional entries and are frequently revisited before trend continuation
- Application: If a pair recently printed a large FVG in a key direction, expect price to revisit it. If it already filled and rejected, use that rejection as confluence for the trend direction.

---

## How to apply to MacroTrade pairs

- Check whether current price is sitting IN a supply zone (reduces confidence in BUY), in a demand zone (reduces confidence in SELL), or in open space between zones (neutral)
- If there is an unfilled imbalance above price and system says BUY → market may need to push through that imbalance first; MODIFIED verdict, wait for context
- If price just completed a retest of a demand zone that held cleanly and structure is bullish → high confidence BUY, aiConfidenceAdjustment +1 or +2
- If price is extended far from any demand zone with no pullback in a long time → overbought extension, likely pullback due; reduce confidence in BUY by -1
