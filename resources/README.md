# ASI 360 Agency — Resource Manifest

> **Engine 3.0 Multi-Property Deployment**
> All licensed assets organized for multi-site production.

## License Allocation

| Product | Version | Target Site | License Type | Purchase Code |
|---------|---------|-------------|--------------|---------------|
| Astra Pro + Spectra Pro | 4.12.2 / 1.2.9 | asi360.co + sandbox | Brainstorm Force Agency | store.brainstormforce.com |
| Cost Calculator | Latest | asi360.co (/estimates) | Envato Regular | `1cba961c-8a8a-45f8-9574-b1cf69ad5af3` |
| Porto | 7.8.3 | shop.asi360.co | Envato Regular | `7d0dc355-fc78-42fe-a445-e392f0f3c20c` |
| WC Extra Product Options | Latest | shop.asi360.co | Envato Regular | `eb7787c2-c9c2-4694-9767-2a6429df3ce8` |
| Table Rate Shipping | Latest | shop.asi360.co | Envato Regular | `1ba31f37-dabb-4baf-8fe0-7602d4108142` |
| Ultimate Affiliate Pro | 9.5.4.1 | shop.asi360.co | Envato Regular | `b2b08fd9-43a7-44b5-a57a-571ea1aa181d` |
| Flatsome | Latest | UNALLOCATED (reserved) | Envato Regular | `ccdaea11-2ba4-4a24-851d-8213c38fd92b` |
| Traveler | 3.2.8.1 | FUTURE property | Envato Regular | `27774fd8-4f85-4600-a98c-61fea66a44e0` |

**All Envato licenses are Regular License — one end product per license.**
**Astra Pro / Spectra Pro use Brainstorm Force agency license — covers multiple sites.**

---

## Directory Structure

```
resources/
├── plugins/
│   ├── astra-stack/           # Astra Pro ecosystem (6 ZIPs)
│   │   ├── astra.4.12.3_theme.zip
│   │   ├── astra-addon-plugin-4.12.2.zip
│   │   ├── astra-premium-sites-4.4.51-1.zip
│   │   ├── astra-template-exporter.zip
│   │   ├── spectra-pro-1.2.9.zip
│   │   └── ultimate-addons-for-gutenberg.zip
│   ├── woocommerce/           # WooCommerce extensions (2 ZIPs)
│   │   ├── codecanyon-W1D0xmJW-woocommerce-extra-product-options-wordpress-plugin.zip
│   │   └── codecanyon-sSN473zn-table-rate-shipping-for-woocommerce.zip
│   └── marketing/             # Revenue & affiliate tools (2 ZIPs)
│       ├── codecanyon-5uhJggFK-ultimate-affiliate-pro-wordpress-plugin.zip
│       └── codecanyon-XW1mwimO-cost-calculator-wordpress-plugin.zip
├── themes/
│   ├── porto/                 # Porto WooCommerce theme (1 ZIP)
│   │   └── themeforest-80chrPWc-porto-...-wordpress-theme.zip
│   └── astra-child/           # ASI 360 child theme export (1 ZIP)
│       └── asi360.zip
├── licenses/                  # Envato license certificates (7 TXT)
│   ├── 57316025-traveler-...-license.txt
│   ├── 58343080-cost-calculator-...-license.txt
│   ├── 58343081-ultimate-affiliate-pro-...-license.txt
│   ├── 58407476-flatsome-...-license.txt
│   ├── 59105179-table-rate-shipping-...-license.txt
│   ├── 59105180-woocommerce-extra-product-options-...-license.txt
│   └── 60672286-porto-...-license.txt
└── README.md                  # This file
```

**NOTE:** ZIP files are gitignored (`resources/**/*.zip`). Only this manifest and license TXT files are tracked in version control.

---

## Dependency Map

### asi360.co (Root Site)
- **Theme:** Astra 4.12.3 + Astra Pro Addon 4.12.2
- **Blocks:** Spectra Free (UAG) + Spectra Pro 1.2.9
- **Templates:** Premium Starter Templates 4.4.51
- **Estimator:** Cost Calculator (BoldThemes) — shortcode `[stm-calc id="1"]`
- **Deploy method:** Site Factory Engine 2.0 (CATALOG→MATCH→PROCESS→DEPLOY)

### shop.asi360.co (E-Commerce)
- **Theme:** Porto 7.8.3 (bundles WPBakery + Revolution Slider + Porto Core)
- **Store:** WooCommerce (free from wp.org)
- **Product Options:** WC Extra Product Options (ThemeComplete)
- **Shipping:** Table Rate Shipping (Bolder Elements) — if shipping physical hardware
- **Affiliate:** Ultimate Affiliate Pro 9.5.4.1 (WPIndeed)
- **Deploy method:** WooCommerce REST API + Gateway MCP tools (NOT Site Factory Engine)

### Key Constraints
- Porto (WPBakery) is NOT compatible with Site Factory Engine 2.0
- Envato Regular License = one end product per license (strict allocation above)
- Astra Pro agency license covers unlimited ASI 360 properties
- Flatsome reserved but unallocated — potential future use or Porto replacement
- Traveler reserved for future travel/experience booking property

---

## Source Files

All assets sourced from `~/Downloads/webdev/` (owner: 500 Grand Live LLC).
Full product capability analysis: `memory/webdev-product-inventory.md` (562 lines).
Astra/Spectra technical reference: `memory/astra-spectra-reference.md` (1400 lines).
