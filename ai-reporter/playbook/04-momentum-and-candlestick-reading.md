# Momentum & Candlestick Reading Rules
Source: jeaFX Bootcamp (Episodes 1, 8, 9) + Voluma Trading Order Flow Guide

## Core Principle
Every candlestick tells a story of the battle between buyers and sellers within a specific time period. Candle bodies show confirmed price movement; wicks show rejected price. Reading momentum — the size, speed, and relative strength of candles — tells you whether buyers or sellers are in control and whether that control is strengthening or weakening.

---

## Rules

### 1. Candle body = confirmed move; wick = rejection
- A large candle body closing far from the open = strong conviction by buyers or sellers
- A long wick with a small body = the market attempted a move in that direction but was rejected before the close
- A wick above = seller rejection of higher prices at that point in time
- A wick below = buyer rejection of lower prices at that point in time
- Never treat a wick as a valid break of structure — only closed candle bodies count

### 2. Impulsive candles signal institutional participation
- Large-bodied candles with minimal wicks = strong directional intent, likely institutional orders
- These candles form the "impulse leg" of the market structure
- When you see a cluster of large same-direction candles: momentum is strong in that direction. Do not fade this.
- Application: If news describes a sudden large directional move with multiple strong candles → this is momentum. Align signal with this direction or mark MODIFIED if system disagrees.

### 3. Corrective/pullback candles look different from impulse candles
- Pullback candles are smaller, slower, have more wicks, and often overlap each other
- The contrast between large impulse candles and small corrective candles tells you which direction is the "true" move
- A correction that produces increasingly large candles (rather than smaller ones) is turning into a new impulse — be alert for structural BOS

### 4. Momentum shift = gradual build then acceleration
- Look for the transition from small overlapping candles (pause/correction) → larger directional candles (new impulse forming)
- When pullback candles get progressively smaller as they approach a S/D zone, this shows sellers are exhausting. The first big bullish candle from this point = momentum resumption.
- Application: If pair is pulling back but pullback candles are shrinking → trade setup forming. If pullback candles are growing → continuation of correction, wait.

### 5. Exhaustion signals (look for these to avoid chasing)
- **Climactic candle at a high or low**: unusually large candle at the end of a trend, followed by smaller candles in the same direction → trend exhaustion, potential reversal
- **Wicks getting longer at trend extremes**: increasing wick size at trend high (for uptrend) shows buyers being rejected repeatedly → weakening momentum
- **Decreasing candle size in trend direction**: if each successive impulse candle is smaller than the last → trend weakening, prepare for reversal

### 6. Multi-candle momentum reading
- Read sequences of candles as a group, not individually
- A strong upward momentum move looks like: 3+ consecutive bullish body candles, each closing near its high, with minimal retracement between them
- A weak or fake rally looks like: candles that partially reverse each other, with wicks in both directions, failing to close near highs
- Application: A "BUY" signal from the system that occurred after a weak multi-candle rally with lots of overlap is less reliable than a BUY that occurred after a clean impulse pullback to demand.

### 7. Rejection candles at key levels = high conviction signals
- A candle that pushes aggressively into a zone and then closes strongly in the opposite direction = rejection
- A bullish rejection candle (bearish wick, bullish close) at a demand zone = buyer entry confirmed
- A bearish rejection candle (bullish wick, bearish close) at a supply zone = seller entry confirmed
- These rejection candles are some of the highest-probability price action signals when they occur at S/D zones with structural confluence

### 8. Don't trade doji / indecision candles at extreme highs/lows
- A doji or spinning top at the extreme of a trend = market indecision, buyers and sellers are balanced
- This is not a reversal signal by itself — it's a PAUSE. Wait for the next candle to confirm direction.
- Application: If most recent candle is a doji at a key level, mark signal as WATCH until direction is confirmed

### 9. Volume and candle size relationship (effort vs result)
- A large candle with high volume = expected: strong effort, strong result
- A large candle with LOW volume = suspicious: the move may not be sustainable (thin market, lack of real conviction)
- A small candle with HIGH volume = absorption: a large player is absorbing orders but price isn't moving much — often precedes a reversal
- Application: If available data shows a directional move on declining volume → momentum is weakening. Reduce confidence in that direction by -1.

---

## How to apply to MacroTrade pairs

- When system says BUY and the most recent daily candles show large bullish bodies with minimal wicks → strong momentum confirmation, aiConfidenceAdjustment +1
- When system says BUY but recent candles show climactic exhaustion (biggest candle at the very top of a trend, followed by smaller candles) → MODIFIED verdict, reduce confidence -1
- When system says SELL and there is a large bullish rejection candle from a demand zone → REJECTED or MODIFIED, reduce confidence -1 or -2
- If the pair has a major news-driven candle (e.g., Fed decision) that gaps through structure → verify whether this is a true impulse (body close through structure) or a wick spike that will be filled
