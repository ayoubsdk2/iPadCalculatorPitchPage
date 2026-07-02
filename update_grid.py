import sys

with open('src/routes/index.tsx', 'r') as f:
    content = f.read()

old_grid_item = """            {ORDER.map((key) => {
              const meta = CELL_META[key];
              const visible = isCellVisible(state, key);
              if (!visible) return <div key={key} aria-hidden />;
              return (
                <ValueCell
                  key={key}
                  title={meta.title}
                  value={state.values[key]}
                  prefix={meta.prefix}
                  suffix={meta.suffix}
                  highlight={step === key}
                  onClick={() => setKeypadFor(key)}
                />
              );
            })}"""

new_grid_item = """            {ORDER.map((key) => {
              const meta = CELL_META[key];
              const visible = isCellVisible(state, key);
              return (
                <div key={key} className={["transition-all duration-500", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"].join(" ")}>
                  <ValueCell
                    title={meta.title}
                    value={state.values[key]}
                    prefix={meta.prefix}
                    suffix={meta.suffix}
                    highlight={step === key}
                    onClick={() => setKeypadFor(key)}
                  />
                </div>
              );
            })}"""

content = content.replace(old_grid_item, new_grid_item)

# Also fix Additional Sales visibility jump
old_additional_sales = """            {isAdditionalSalesVisible(state) ? (
              <ValueCell title="Additional Sales" value={additionalSales} prefix="$" readOnly />
            ) : (
              <div aria-hidden />
            )}"""

new_additional_sales = """            <div className={["transition-all duration-500", isAdditionalSalesVisible(state) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"].join(" ")}>
              <ValueCell title="Additional Sales" value={additionalSales} prefix="$" readOnly />
            </div>"""

content = content.replace(old_additional_sales, new_additional_sales)

with open('src/routes/index.tsx', 'w') as f:
    f.write(content)
