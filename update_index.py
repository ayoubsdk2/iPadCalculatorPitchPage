import sys

with open('src/routes/index.tsx', 'r') as f:
    content = f.read()

# Fix RoleEditor visibility
old_role_wrap = """          <section className="phaos-role-wrap">
            {isRoleVisible(state) ? (
              <RoleEditor roles={state.roles} monthlyCalls={monthlyCalls} />
            ) : null}
          </section>"""

new_role_wrap = """          <section className={["phaos-role-wrap transition-all duration-500", isRoleVisible(state) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"].join(" ")}>
            <RoleEditor roles={state.roles} monthlyCalls={monthlyCalls} />
          </section>"""

# Fix results grid internal visibility
# We'll do this by modifying the panels themselves inside the grid.

# Slider Panel
old_slider_panel = """            <div className="phaos-slider-panel">
              {isSliderVisible(state) ? (
                <>
                  <div className="text-[1rem] font-extrabold text-foreground">
                    What % of calls can AI resolve?
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.72rem] font-bold text-muted-foreground">1%</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={state.resolvePct ?? 1}
                      onChange={(e) => calcStore.set({ resolvePct: Number(e.target.value) })}
                      className="phaos-range flex-1"
                      style={{ ["--val" as never]: `${state.resolvePct ?? 1}%` } as React.CSSProperties}
                      aria-label="AI resolution percentage"
                    />
                    <span className="text-[0.72rem] font-bold text-muted-foreground">100%</span>
                  </div>
                  {state.resolvePct !== null && (
                    <div className="text-center font-black text-[2rem] leading-none text-primary tabular-nums">
                      {state.resolvePct}%
                    </div>
                  )}
                </>
              ) : null}
            </div>"""

new_slider_panel = """            <div className={["phaos-slider-panel transition-all duration-500", isSliderVisible(state) ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}>
                <>
                  <div className="text-[1rem] font-extrabold text-foreground">
                    What % of calls can AI resolve?
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.72rem] font-bold text-muted-foreground">1%</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={state.resolvePct ?? 1}
                      onChange={(e) => calcStore.set({ resolvePct: Number(e.target.value) })}
                      className="phaos-range flex-1"
                      style={{ ["--val" as never]: `${state.resolvePct ?? 1}%` } as React.CSSProperties}
                      aria-label="AI resolution percentage"
                    />
                    <span className="text-[0.72rem] font-bold text-muted-foreground">100%</span>
                  </div>
                  <div className={["text-center font-black text-[2rem] leading-none text-primary tabular-nums transition-opacity", state.resolvePct !== null ? "opacity-100" : "opacity-0"].join(" ")}>
                    {state.resolvePct ?? 0}%
                  </div>
                </>
            </div>"""

content = content.replace(old_role_wrap, new_role_wrap)
content = content.replace(old_slider_panel, new_slider_panel)

# Financial Panel
old_financial_panel = """            <div className="phaos-financial-panel">
              {showResultsRow ? (
                <>
                  <RevealCell
                    title="FINANCIAL SAVINGS!"
                    value={`${financialSavings >= 0 ? "+" : ""}${formatUSD(Math.round(financialSavings))}`}
                    revealed={state.revealedSavings}
                    onReveal={() => calcStore.set({ revealedSavings: true })}
                    borderless
                    compact
                  />
                  {state.revealedSavings && (
                    <ul className="phaos-savings-breakdown">
                      {breakdown.recovered > 0 && <li>Recovered bookings · {formatUSD(Math.round(breakdown.recovered))}</li>}
                      {breakdown.aiRevenue > 0 && <li>AI-driven sales · {formatUSD(Math.round(breakdown.aiRevenue))}</li>}
                      {breakdown.laborSaved > 0 && <li>Labor refocused · {formatUSD(Math.round(breakdown.laborSaved))}</li>}
                    </ul>
                  )}
                </>
              ) : null}
            </div>"""

new_financial_panel = """            <div className={["phaos-financial-panel transition-all duration-500", showResultsRow ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}>
                  <RevealCell
                    title="FINANCIAL SAVINGS!"
                    value={`${financialSavings >= 0 ? "+" : ""}${formatUSD(Math.round(financialSavings))}`}
                    revealed={state.revealedSavings}
                    onReveal={() => calcStore.set({ revealedSavings: true })}
                    borderless
                    compact
                  />
                  <ul className={["phaos-savings-breakdown transition-all duration-500", state.revealedSavings ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")}>
                    {breakdown.recovered > 0 && <li>Recovered bookings · {formatUSD(Math.round(breakdown.recovered))}</li>}
                    {breakdown.aiRevenue > 0 && <li>AI-driven sales · {formatUSD(Math.round(breakdown.aiRevenue))}</li>}
                    {breakdown.laborSaved > 0 && <li>Labor refocused · {formatUSD(Math.round(breakdown.laborSaved))}</li>}
                  </ul>
            </div>"""

content = content.replace(old_financial_panel, new_financial_panel)

# Price Panel
old_price_panel = """            <div className="phaos-price-panel">
              {state.revealedSavings && !overThreshold && (
                <>
                  <RevealCell
                    title="Phaos AI Voice Agent"
                    value={`${formatUSD(Math.round(phaosPrice))}/mo`}
                    revealed={state.revealedPrice}
                    onReveal={() => calcStore.set({ revealedPrice: true })}
                    borderless
                    compact
                  />
                  {state.revealedPrice && <p className="phaos-usage-line">usage-based month-to-month!</p>}
                </>
              )}
              {state.revealedSavings && overThreshold && (
                <button onClick={() => setCustomPricingOpen(true)} className="w-full h-full flex flex-col justify-center text-center" data-no-stage-tap>
                  <div className="text-[1.05rem] font-extrabold uppercase">Phaos AI Voice Agent</div>
                  <div className="font-black text-[2.4rem] text-primary mt-1">Custom Pricing</div>
                  <div className="text-xs text-muted-foreground">Over {CUSTOM_PRICING_CALL_THRESHOLD.toLocaleString()} calls</div>
                </button>
              )}
            </div>"""

new_price_panel = """            <div className={["phaos-price-panel transition-all duration-500", state.revealedSavings ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}>
              {!overThreshold ? (
                <>
                  <RevealCell
                    title="Phaos AI Voice Agent"
                    value={`${formatUSD(Math.round(phaosPrice))}/mo`}
                    revealed={state.revealedPrice}
                    onReveal={() => calcStore.set({ revealedPrice: true })}
                    borderless
                    compact
                  />
                  <p className={["phaos-usage-line transition-opacity", state.revealedPrice ? "opacity-100" : "opacity-0"].join(" ")}>usage-based month-to-month!</p>
                </>
              ) : (
                <button onClick={() => setCustomPricingOpen(true)} className="w-full h-full flex flex-col justify-center text-center" data-no-stage-tap>
                  <div className="text-[1.05rem] font-extrabold uppercase">Phaos AI Voice Agent</div>
                  <div className="font-black text-[2.4rem] text-primary mt-1">Custom Pricing</div>
                  <div className="text-xs text-muted-foreground">Over {CUSTOM_PRICING_CALL_THRESHOLD.toLocaleString()} calls</div>
                </button>
              )}
            </div>"""

content = content.replace(old_price_panel, new_price_panel)

with open('src/routes/index.tsx', 'w') as f:
    f.write(content)
