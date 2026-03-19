# Diamond Heights Village Association - Access Control Assessment Report

**Site:** 115 Red Rock Way, San Francisco, CA 94131
**Contact:** Melissa Tolerton (DHVA c/o PMP, LLC)
**Contact Email:** dhva@pmpmanage.com
**Contact Phone:** (415) 824-3535
**Building Type:** Residential / HOA
**Doors:** 10
**Readers:** 10
**Referred By:** Keri Systems
**Assessment Date:** March 2026
**Report Generated:** 2026-03-18

---

## 1. EXECUTIVE SUMMARY

Diamond Heights Village Association operates a Keri Systems PXL-500-based access control system controlling 10 doors with 10 readers across a residential HOA complex. The system uses legacy NXT/MS-series proximity readers (26-bit Wiegand) and a PXL-250 Tiger Controller as the head-end. A competing quote from Warman Security (Quote #0000170292, dated 3/11/2026) proposes converting to Keri Borealis cloud-based access control with 1,000 key fobs. Prices on the competitor quote are redacted.

**Key Finding:** The existing hardware is functional but aging. All 4 PXL-500 controllers and the Tiger Controller were manufactured in 2019. The readers show significant weathering and wear. The system is a strong candidate for a Borealis cloud migration that retains existing wiring infrastructure.

---

## 2. CONTROLLERS - PXL-500 (Quantity: 4)

All four controllers are Keri Systems **PXL-500** boards. Serial numbers read from barcode labels on the PCBs:

| Controller # | Serial Number | Board Silkscreen | Voltage Regulator | Condition |
|---|---|---|---|---|
| Access Control 1 | **PXL500P190125385** | PXL-SXX, NR / LC-SXX, NR | L7805ACV (ST) | Good - clean board, green LEDs active |
| Access Control 2 | **PXL500P182524043** | PXL-SXX, NR / LC-SXX, NR | 1H52AF / LM7805AC | Good - clean board, green LEDs active |
| Access Control 3 | **PXL500P190125385** | PXL-SXX, NR / LC-SXX, NR | L7805ACV (ST) | Good - clean board, green LEDs active |
| Access Control 4 | **PXL500P190125374** | PXL-SXX, NR / LC-SXX, NR | L7805ACV (ST) | Good - cables partially obscuring board, green LEDs active |

**Notes:**
- All boards bear the **Keri Systems Incorporated** logo and **CE0984** certification mark
- Board revision appears consistent across all 4 units (2018-2019 manufacture based on serial prefix)
- Controller 2 serial (182524043) suggests a slightly earlier manufacture date than the other three (190125xxx series)
- Controllers 1 and 3 share the same serial number (PXL500P190125385) -- this should be verified on-site as it may be the same board photographed from two angles, or a data entry error
- All boards have READER and POWER connectors (JP5) visible
- TEST headers and J4 diagnostic connectors present on all boards

### Enclosures (PXL-500)

The 4 PXL-500 controllers are housed in standard **Keri Systems black metal enclosures** with:
- Keri Systems logo + "Access Control Systems" + "www.kerisys.com" on face
- Tubular key lock with key present on all units
- Wall-mounted with cable runs entering from top
- Condition: Minor surface scratches, dust accumulation, overall GOOD structural condition
- All enclosures appear to be the standard KRE-2 (Lock Enclosure, P/N 05270-001) based on the wiring diagram reference

---

## 3. TIGER CONTROLLER - PXL-250 (Quantity: 1)

### Exterior
- **Model:** PXL-250 Tiger Controller
- **Manufacturer:** Keri Systems Incorporated, San Jose, CA USA
- **U.S. Patent No.:** 6157952
- Beige/tan metal enclosure with tubular key lock
- Sticker label clearly reads "PXL-250 Tiger Controller"
- Yellow Ethernet cable connected (network-enabled)
- Green LED indicator active on external interface

### Interior (from "Tiger Controller - Inside" photo)
- **Main Board:** Keri Systems SB593, ASSY 04379, CE0984
- **Board Date:** 2007 copyright mark on silkscreen
- **Firmware/Board Label:** 02020-005, REV 1.4
- **Satellite Board:** SB-593-1, serial 190416518RevH, P/N 05379-001
- **Network Module:** XPC1001008 (Ethernet/IP module visible)
- RS-232 serial connector present (DB-9)
- Multiple green LEDs active (LEDS5, power indicators)
- Terminal blocks for readers, locks, alarms, DIO outputs visible
- General Purpose outputs (GP 3 Out NO/NC, GP 4 Out) on left terminal blocks

### Tiger Controller Serial (from PCB barcode)
- **Serial:** PXL500P190125373 (NOTE: barcode reads PXL500 despite being labeled PXL-250 Tiger Controller on the exterior -- this is normal; the Tiger uses the same PXL-500 PCB)

### Wiring Diagram (from "Tiger Controller - Drawing" photo)
- Full PXL-250 Tiger Controller wiring diagram posted inside enclosure door
- Shows: PXL-250 main board + SB-293 Satellite Board layout
- Handwritten note on diagram: "R1" and "1/F DOWN STAIRS" and "R2" -- indicating Reader 1 and Reader 2 assignments, with one reader serving a downstairs location
- Enclosure model confirmed: **KRE-2, LOCK ENCLOSURE, 05270-001**
- ASSY 04174 and ASSY 04176 referenced for main board assemblies

---

## 4. POWER SUPPLY (Quantity: 1)

### KPS-11 Power Supply
- **Model:** Keri Systems KPS-11 Power Supply
- **P/N (from barcode label):** 05279-001
- **S/N (from barcode label):** 19070001E (partially readable)
- Beige/tan metal enclosure, wall-mounted
- Keri Systems Incorporated logo on front label
- Wires (blue crimp connector, red/black power) exiting from bottom

### Unknown Panel (Power/Battery Enclosure)
- **Exterior:** Plain beige/tan metal panel, no labeling visible, wall-mounted with Phillips screws
- **Interior contents:**
  - **Transformer:** ESD (Electronic Security Devices, Inc.) model **X-1656**, 16vac, 3.5 Amps, UL 506, Livermore, CA. Input: 2&4=110vac, 6&10=16[vac]
  - **Batteries (x2):** Power Patrol by Interstate Batteries, model **FAS1075**, Fire & Security rated
    - 12V 7Ah (20 HR) / 12V 5.85Ah (5 HR)
    - Sealed Maintenance-free, Rechargeable, Nonspillable - AGM
    - Max Charge Current: 2.10A
    - Price label visible: $36.50 EA (FAS1075)
  - **PCB:** Small control board visible (likely battery charger/monitor)
  - Fuse holder with inline fuse visible

**Battery Condition:** The batteries appear to be in serviceable condition based on the photo, but age should be verified on-site. Interstate Batteries FAS1075 are standard replacements available through security distributors.

---

## 5. READERS (Quantity: 10)

### Reader Type Identification

**Two distinct reader models identified across the 10 readers:**

#### Type A: Small Black Mullion Readers (8 units)
- **Readers:** 1, 4, 5, 6, 7, 8, 9, 10
- **Identified Model:** Keri Systems **MS-5000** (or similar MS-series miniature mullion proximity reader)
- **Form Factor:** Small, compact, oblong/pill-shaped black plastic housing
- **Dimensions (estimated):** ~3" x 1.5" (mullion-mount form factor)
- **LED:** Single center LED (green when idle on Reader 1; amber/orange on Readers 4-10)
- **Mounting:** Phillips head screws, surface-mounted on stucco, wood, and painted metal gate frames
- **Technology:** 26-bit Wiegand proximity (NXT/MS-series)
- **Environment:** Outdoor-exposed at gate locations

**Condition by Reader:**
| Reader | Location Context | LED Color | Physical Condition |
|---|---|---|---|
| 1 | Wood/stucco exterior wall | Green | GOOD - minor scratches |
| 4 | Stucco wall near metal gate | Off/dim | FAIR - surface scratches, scuffed |
| 5 | Stucco wall near metal gate | Off/dim | FAIR - surface scratches |
| 6 | Stucco wall near metal gate/railing | Amber | GOOD - minor scratches |
| 7 | Black metal gate frame, above expanded metal mesh | Amber | FAIR - scratched, weathered |
| 8 | Black metal gate frame, above expanded metal mesh | Amber | FAIR - scratched, weathered |
| 9 | Black metal gate frame, above expanded metal mesh | Amber | FAIR - worn housing, edge wear |
| 10 | Black metal gate frame, above expanded metal mesh | Amber | FAIR - wear visible, debris around mount |

#### Type B: Larger Beige/Ivory Readers (2 units)
- **Readers:** 2, 3
- **Identified Model:** Keri Systems **NXT-2R** or **NXT-3R** (mid-size NXT-series proximity reader)
- **Form Factor:** Wider, squarish beige/ivory plastic housing with curved front
- **Dimensions (estimated):** ~4" x 3.5" (standard wall-mount form factor)
- **LED:** Single center LED (amber/orange)
- **Mounting:** Phillips head screws, surface-mounted on wood and stucco walls
- **Technology:** 26-bit Wiegand proximity (NXT-series)

**Condition by Reader:**
| Reader | Location Context | LED Color | Physical Condition |
|---|---|---|---|
| 2 | Wood trim/doorframe, interior-like location | Amber | FAIR - yellowed plastic, discoloration around LED (heat/UV aging) |
| 3 | Stucco exterior wall | Amber | POOR - heavily yellowed, dirty, paint overspray visible, significant UV degradation |

### Reader Summary
- All 10 readers are powered and showing LED activity (functional)
- The 8 black mullion readers are weathered but functional
- The 2 beige NXT-series readers show significant UV degradation and should be prioritized for replacement
- All readers appear to use legacy 26-bit Wiegand NXT/MS proximity technology

---

## 6. SYSTEM OVERVIEW PHOTO ANALYSIS

The "Keri Panels" wide-shot shows the full equipment room/closet installation:

**Visible from left to right:**
1. **KPS-11 Power Supply** (beige, upper left) with battery backup enclosure below
2. **4x PXL-500 Controller Enclosures** (black, wall-mounted in a row) - all with doors open showing green PCB boards with active green LEDs
3. **"Key Log" sheet** posted on wall between power supply and controllers
4. **PXL-250 Tiger Controller** (beige, lower right area) with wiring diagram visible
5. **Additional red enclosure** (far right) - appears to be a fire alarm panel or auxiliary power supply
6. **Network switch/hub** visible with Ethernet cabling
7. Cable management: Mix of white Ethernet cables, yellow Ethernet (to Tiger), and multi-conductor wiring throughout

**Installation Quality:** The installation appears professional but dated. Cable management could be improved. All enclosures are properly wall-mounted. The room appears to be a utility/mechanical closet with adequate ventilation.

---

## 7. COMPETITOR QUOTE ANALYSIS

**Warman Security Quote #0000170292** (dated 3/11/2026):

- **Bill To:** Diamond Heights Village Association, C/O Dept. 513 - PMP, LLC, P.O. Box 4579, Houston TX 77210-4579
- **Location:** 115 Red Rock Way, San Francisco CA 94131, Attn: Melissa
- **Salesperson:** Sam
- **Terms:** NET 30

**Line Items (prices redacted):**
| Qty | Description |
|---|---|
| -- | Convert Keri access to cloud based Keri Borealis with 1000 Key Fob for Club House as quoted |
| 1,000 | Proximity Key Fob |
| 1 | Borealis Hub for Cloud Based Administration & Hosting Services |
| 1 | Set up fee |
| -- | *Note: Warman Security assumes existing wiring, power and existing elec. hardware is good. Repairs made will be on a T&M basis* |
| 1 | Yearly subscription for 10 doors/Borealis |
| 1 | Shipping & Handling |
| 1 | Electronic Labor |

**Key Intelligence:**
- Competitor proposes Keri Borealis cloud migration (same direction we would recommend)
- 1,000 key fobs is a large order for a residential HOA -- confirms high resident count
- Competitor assumes existing wiring is good (T&M for any repairs) -- same assumption we should validate
- Competitor includes Borealis Hub + yearly subscription for 10 doors
- Quote expires 30 days from date (expires ~4/10/2026)
- 90-day warranty on labor; 25% cancellation fee after parts ordered

---

## 8. COMPLETE HARDWARE INVENTORY

| Category | Model | Quantity | Serial Numbers | Condition | Action |
|---|---|---|---|---|---|
| Controller | PXL-500 | 4 | PXL500P190125385, PXL500P182524043, PXL500P190125385, PXL500P190125374 | Good | Retain or upgrade to NXT-MSC |
| Tiger Controller | PXL-250 Tiger | 1 | PXL500P190125373 (on PCB) | Good | Replace with Borealis Hub |
| Satellite Board | SB-593-1 | 1 | 190416518RevH (P/N 05379-001) | Good | Part of Tiger -- replace together |
| Power Supply | KPS-11 | 1 | P/N 05279-001, S/N 19070001x | Good | Retain -- compatible with Borealis |
| Transformer | ESD X-1656 | 1 | -- | Good | Retain if voltage matches |
| Backup Battery | Interstate FAS1075 | 2 | -- | Unknown (test on-site) | Replace if >3 years old |
| Reader (Mullion) | MS-5000 or similar | 8 | -- | Fair (weathered) | Replace with NXT-4R or Borealis-compatible |
| Reader (Mid-size) | NXT-2R/3R or similar | 2 | -- | Poor (UV degraded) | Replace - priority |
| Enclosure | KRE-2 (05270-001) | 5 | -- | Good | Retain |
| Enclosure | KPS-11 enclosure | 1 | -- | Good | Retain |

**Total Equipment Points:** 10 doors, 10 readers, 5 controller boards (4x PXL-500 + 1x Tiger/PXL-250), 1 power supply, 2 backup batteries

---

## 9. RECOMMENDED REPLACEMENT PARTS (Keri Current Product Line)

### Option A: Borealis Cloud Migration (Recommended)

This aligns with the competitor's proposal but we can offer better pricing and service:

| Item | Keri Part # | Qty | Purpose |
|---|---|---|---|
| Borealis Hub | BOR-HUB | 1 | Cloud controller replacing Tiger PXL-250 |
| Borealis NXT Readers | NXT-4R (or NXT-7R for high-security) | 10 | Replace all 10 existing readers |
| Proximity Key Fobs | NXT-K | 1,000 | Resident credentials (match competitor quote) |
| Yearly Cloud Subscription | BOR-SUB-10 | 1 | 10-door Borealis license |
| Backup Batteries | FAS1075 (or equivalent 12V 7Ah SLA) | 2 | Replace aging batteries |

**Retain from existing system:**
- 4x PXL-500 boards (Borealis Hub communicates with existing PXL-500s via RS-485)
- 5x KRE-2 enclosures
- KPS-11 power supply
- ESD X-1656 transformer
- All existing wiring (Wiegand runs, power, RS-485 bus)

### Option B: Full NXT Upgrade (On-Premise)

If client prefers on-premise over cloud:

| Item | Keri Part # | Qty | Purpose |
|---|---|---|---|
| NXT-MSC Controller | NXT-MSC | 1 | Replace Tiger PXL-250 as master controller |
| NXT-4R Readers | NXT-4R | 10 | Replace all readers |
| NXT Key Fobs | NXT-K | 1,000 | Resident credentials |
| Doors.NET Software | DNETSW | 1 | On-premise management software |
| Backup Batteries | 12V 7Ah SLA | 2 | Replace aging batteries |

---

## 10. ITEMS REQUIRING KERI SYSTEMS QUOTE

Request pricing from Keri Systems for the following:

1. **Borealis Hub (BOR-HUB)** -- 1 unit
2. **Borealis 10-door annual subscription** -- 1 year
3. **NXT-4R Proximity Readers** -- 10 units (confirm compatibility with existing PXL-500 Wiegand inputs)
4. **NXT-K Proximity Key Fobs** -- 1,000 units (26-bit Wiegand NXT format)
5. **Confirm PXL-500 board compatibility** with Borealis Hub (serial numbers provided above for Keri to verify firmware version and compatibility)
6. **SB-293/SB-593 satellite board** -- confirm if needed with Borealis or if the Hub replaces this entirely
7. **KPS-11 compatibility** with Borealis Hub power requirements

### Questions for Keri Systems:
- Can the 4 existing PXL-500 boards (2018-2019 manufacture) communicate with the Borealis Hub without firmware updates?
- Does the Borealis Hub require a dedicated Ethernet drop or can it share the existing network connection currently used by the Tiger?
- Is there a migration discount for existing Keri PXL system customers?
- What is the NXT-K fob read range with the NXT-4R reader vs the existing MS-5000 readers?
- Are the existing MS-5000 readers compatible with NXT-format credentials, or must readers be replaced for the new fobs?

---

## 11. PDFs FOR MANUAL REVIEW

The following PDFs were downloaded but contain image-based content requiring visual review:

| File | Contents | Key Findings |
|---|---|---|
| Keri Power Supply.pdf | Photo of KPS-11 Power Supply front label | Confirms KPS-11 model with Keri Systems branding |
| Keri Access Control 1.pdf | Photo of black Keri enclosure (closed, with key) | Standard KRE-2 enclosure, good condition |
| Keri Access Control 2.pdf | Photo of two stacked black Keri enclosures (with keys) | Two enclosures stacked vertically, good condition |
| Keri Access Control 3.pdf | Photo of black Keri enclosure (with key) | Standard KRE-2 enclosure, good condition |
| Keri Access Control 4.pdf | Photo of black Keri enclosure (with key) | Standard KRE-2 enclosure, good condition |
| Redacted Quote.pdf | Warman Security Quote #0000170292 | Competitor proposal -- see Section 7 for full analysis |

---

## 12. SITE VISIT CHECKLIST

Items to verify/complete during on-site assessment:

- [ ] Confirm Controllers 1 and 3 serial numbers (photos may show same board twice -- verify PXL500P190125385 is on both)
- [ ] Test backup battery voltage (FAS1075 x2) -- replace if below 12.4V or older than 3 years
- [ ] Photograph all 10 door strikes/locks (not captured in submitted photos)
- [ ] Document reader-to-door mapping (which reader controls which door)
- [ ] Verify network connectivity type (Ethernet to Tiger -- DHCP or static?)
- [ ] Check Doors.NET or NXT software version on workstation
- [ ] Verify RS-485 bus wiring between PXL-500 boards and Tiger Controller
- [ ] Confirm total Wiegand cable runs from controllers to readers (length estimates for any re-pull needs)
- [ ] Inspect the red enclosure visible in the overview photo (fire alarm panel?)
- [ ] Test all 10 readers with an existing fob to confirm read functionality
- [ ] Document any electric strikes or maglocks at each door
- [ ] Identify gate operators (if any -- some readers appear to be on metal gates with expanded mesh)
- [ ] Get current resident/fob count from property management
- [ ] Obtain copy of existing system programming (schedules, access levels, holiday table)

---

*Report prepared by ASI 360 Security Integration*
*All serial numbers and model identifications based on visual photo analysis -- verify on-site before ordering*
