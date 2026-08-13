import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ETF_KEYS, getEtfConfig } from "./data";
import { EtfReturnChart } from "./EtfReturnChart";
import "./etfReturns.css";
import type { EtfKey } from "./types";

export function EtfReturnsPage() {
  const [selectedKey, setSelectedKey] = useState<EtfKey>("qqq");
  const config = getEtfConfig(selectedKey);

  return (
    <main className="etf-page">
      <div className="etf-page-shell">
        <nav className="etf-page-nav" aria-label="页面导航">
          <Link className="etf-back-link" to="/" aria-label="返回 Binance Watchboard">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>返回 Binance Watchboard</span>
          </Link>
        </nav>

        <header className="etf-page-header">
          <div className="etf-page-heading">
            <p className="etf-page-eyebrow">Total Return</p>
            <h1>ETF 总回报</h1>
            <p>以月度复权收盘价观察一万元本金的长期水上与水下变化</p>
          </div>

          <div className="etf-fund-field">
            <label htmlFor="etf-fund-select">选择基金</label>
            <div className="etf-select-wrap">
              <select
                id="etf-fund-select"
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.target.value as EtfKey)}
              >
                {ETF_KEYS.map((key) => {
                  const item = getEtfConfig(key);
                  return (
                    <option key={key} value={key}>
                      {item.selectLabel}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </header>

        <article className="etf-page-card">
          <EtfReturnChart config={config} />
        </article>
      </div>
    </main>
  );
}
