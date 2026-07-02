import sys

with open('src/routes/index.tsx', 'r') as f:
    content = f.read()

old_cta_zone = """            <div className="phaos-cta-zone">
              {state.showImSold && (
                <button onClick={() => toast("Sign up flow — wiring next pass.")} className="cta-embossed phaos-sold-button animate-fade-in" data-no-stage-tap>
                  <span className="phaos-sold-main">I'M SOLD!</span>
                  <span className="phaos-sold-sub">Sign Up Now</span>
                </button>
              )}
              {state.showAdvanced && (
                <button onClick={() => toast("Advanced Pricing — wiring next pass.")} className="phaos-advanced-link animate-fade-in" data-no-stage-tap>
                  Advanced Pricing →
                </button>
              )}
            </div>"""

new_cta_zone = """            <div className="phaos-cta-zone">
                <button 
                  onClick={() => toast("Sign up flow — wiring next pass.")} 
                  className={["cta-embossed phaos-sold-button transition-all duration-700", state.showImSold ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"].join(" ")}
                  data-no-stage-tap
                >
                  <span className="phaos-sold-main">I'M SOLD!</span>
                  <span className="phaos-sold-sub">Sign Up Now</span>
                </button>
                <button 
                  onClick={() => toast("Advanced Pricing — wiring next pass.")} 
                  className={["phaos-advanced-link transition-all duration-700 delay-200", state.showAdvanced ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"].join(" ")}
                  data-no-stage-tap
                >
                  Advanced Pricing →
                </button>
            </div>"""

content = content.replace(old_cta_zone, new_cta_zone)

with open('src/routes/index.tsx', 'w') as f:
    f.write(content)
