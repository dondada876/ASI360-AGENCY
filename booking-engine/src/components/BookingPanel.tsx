'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZONES, ZONE_COLORS } from '@/lib/zones'
import { PRICING_TIERS, ADD_ONS, TIME_SLOTS, RESTAURANT_PARTNERS, calculateTotal } from '@/lib/pricing'
import type { SpotType, TimeSlot } from '@/types/booking'

interface BookingPanelProps {
  selectedZone: string | null
  onClose: () => void
}

type Step = 'zone' | 'tier' | 'time' | 'addons' | 'food' | 'checkout'

export default function BookingPanel({ selectedZone, onClose }: BookingPanelProps) {
  const [step, setStep] = useState<Step>('tier')
  const [selectedTier, setSelectedTier] = useState<SpotType | null>(null)
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null)
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [memberCode, setMemberCode] = useState('')

  const zone = ZONES.find((z) => z.id === selectedZone)
  if (!zone) return null

  const totals = useMemo(() => {
    if (!selectedTier || !selectedTime) return { subtotal: 0, discount: 0, total: 0 }
    return calculateTotal(selectedTier, selectedTime, selectedAddOns, memberCode)
  }, [selectedTier, selectedTime, selectedAddOns, memberCode])

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const canProceed = () => {
    switch (step) {
      case 'tier': return selectedTier !== null
      case 'time': return selectedTime !== null && selectedDate !== ''
      case 'addons': return true
      case 'food': return true
      default: return false
    }
  }

  const nextStep = () => {
    const steps: Step[] = ['tier', 'time', 'addons', 'food', 'checkout']
    const idx = steps.indexOf(step)
    if (idx < steps.length - 1) setStep(steps[idx + 1])
  }

  const prevStep = () => {
    const steps: Step[] = ['tier', 'time', 'addons', 'food', 'checkout']
    const idx = steps.indexOf(step)
    if (idx > 0) setStep(steps[idx - 1])
  }

  const tier = PRICING_TIERS.find((t) => t.type === selectedTier)

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 glass-dark flex flex-col"
    >
      {/* ── Header ──────────────────────────── */}
      <div className="p-5 border-b border-cream/10">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream/10 transition-colors text-cream/60 hover:text-cream"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3L3 15M3 3l12 12" />
            </svg>
          </button>

          {/* Step indicator */}
          <div className="flex gap-1.5">
            {['tier', 'time', 'addons', 'food', 'checkout'].map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 bg-gold' : i < ['tier', 'time', 'addons', 'food', 'checkout'].indexOf(step) ? 'w-3 bg-gold/50' : 'w-3 bg-cream/15'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full ring-2 ring-offset-1 ring-offset-lake-deep"
            style={{ background: ZONE_COLORS[zone.sunsetQuality], boxShadow: `0 0 0 2px ${ZONE_COLORS[zone.sunsetQuality]}` }}
          />
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-cream">
              {zone.name}
            </h2>
            <p className="text-xs text-cream/50">{zone.label} &middot; {zone.description}</p>
          </div>
        </div>

        {zone.sunsetQuality === 'golden' && (
          <div className="mt-3 glass-gold rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-sm">🌇</span>
            <span className="text-xs text-gold">Premium sunset zone — golden light until 8pm</span>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto booking-scroll p-5">
        <AnimatePresence mode="wait">
          {/* ── Step 1: Choose Tier ── */}
          {step === 'tier' && (
            <motion.div
              key="tier"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-cream/40 mb-4">
                Choose Your Setup
              </h3>

              {PRICING_TIERS.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedTier(t.type)}
                  className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                    selectedTier === t.type
                      ? 'glass-gold border-glow-gold'
                      : 'glass hover:border-cream/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{t.icon}</span>
                      <div>
                        <div className="font-[family-name:var(--font-display)] text-lg font-medium text-cream">
                          {t.label}
                        </div>
                        <div className="text-xs text-cream/50">{t.description}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {Object.entries(t.prices).map(([slot, price]) => {
                      const slotConfig = TIME_SLOTS.find((s) => s.id === slot)
                      return (
                        <div key={slot} className="text-center bg-cream/5 rounded-lg px-3 py-1.5">
                          <div className="text-[10px] text-cream/40">{slotConfig?.label}</div>
                          <div className="text-sm font-semibold" style={{ color: t.color }}>
                            ${price}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.includes.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] bg-cream/5 text-cream/50 px-2 py-0.5 rounded-full"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Step 2: Choose Time ── */}
          {step === 'time' && (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-cream/40 mb-4">
                Pick Your Date & Time
              </h3>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full glass rounded-xl px-4 py-3 text-cream bg-transparent outline-none focus:border-gold/40 transition-colors text-sm"
              />

              <div className="space-y-2 mt-4">
                {TIME_SLOTS.map((slot) => {
                  const price = tier?.prices[slot.id]
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedTime(slot.id)}
                      className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                        selectedTime === slot.id
                          ? 'glass-gold border-glow-gold'
                          : 'glass hover:border-cream/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{slot.icon}</span>
                          <div>
                            <div className="font-medium text-cream">{slot.label}</div>
                            <div className="text-xs text-cream/50">{slot.time}</div>
                          </div>
                        </div>
                        <div className="text-lg font-semibold text-gold">${price}</div>
                      </div>
                      <p className="text-xs text-cream/40 mt-2 ml-9">{slot.description}</p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Add-ons ── */}
          {step === 'addons' && (
            <motion.div
              key="addons"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-cream/40 mb-4">
                Enhance Your Experience
              </h3>

              {['comfort', 'food', 'entertainment'].map((category) => (
                <div key={category} className="mb-4">
                  <div className="text-xs text-cream/30 uppercase tracking-widest mb-2">
                    {category}
                  </div>
                  <div className="space-y-2">
                    {ADD_ONS.filter((a) => a.category === category).map((addon) => (
                      <button
                        key={addon.id}
                        onClick={() => toggleAddOn(addon.id)}
                        className={`w-full text-left rounded-xl p-3 transition-all duration-200 flex items-center justify-between ${
                          selectedAddOns.includes(addon.id)
                            ? 'glass-gold border-glow-gold'
                            : 'glass hover:border-cream/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{addon.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-cream">{addon.name}</div>
                            <div className="text-xs text-cream/40">{addon.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ember">+${addon.price}</span>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                              selectedAddOns.includes(addon.id) ? 'bg-gold text-dusk' : 'bg-cream/10'
                            }`}
                          >
                            {selectedAddOns.includes(addon.id) && (
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M2 6l3 3 5-5" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Step 4: Restaurant Partners ── */}
          {step === 'food' && (
            <motion.div
              key="food"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-cream/40 mb-1">
                Order Food Delivered to Your Spot
              </h3>
              <p className="text-xs text-cream/50 mb-4">
                We walk it across from Grand Ave. Scan your pole QR to order anytime.
              </p>

              {RESTAURANT_PARTNERS.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="glass rounded-xl p-4 hover:border-cream/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-lg font-medium text-cream">
                        {restaurant.name}
                      </div>
                      <div className="text-xs text-cream/50">
                        {restaurant.cuisine} &middot; {restaurant.priceRange} &middot;{' '}
                        <span className="text-sage-light">{restaurant.deliveryTime}</span>
                      </div>
                    </div>
                    {restaurant.url && (
                      <a
                        href={restaurant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gold hover:text-gold-light transition-colors px-2 py-1 rounded-lg glass-gold"
                      >
                        Menu
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-cream/40 mb-3">{restaurant.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {restaurant.featured.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] bg-ember/10 text-ember-light px-2.5 py-1 rounded-full"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className="glass-gold rounded-xl p-4 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📍</span>
                  <span className="text-sm font-medium text-gold">QR Pole Delivery</span>
                </div>
                <p className="text-xs text-cream/50">
                  Each light pole has a QR code. Scan it anytime during your session to order food
                  delivered to your exact location. No app needed — just scan and order.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 5: Checkout ── */}
          {step === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-cream/40 mb-4">
                Review & Confirm
              </h3>

              {/* Summary */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cream/60">Zone</span>
                  <span className="text-sm font-medium text-cream">{zone.name} ({zone.label})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cream/60">Setup</span>
                  <span className="text-sm font-medium text-cream">{tier?.icon} {tier?.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cream/60">Date</span>
                  <span className="text-sm font-medium text-cream">{selectedDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cream/60">Time</span>
                  <span className="text-sm font-medium text-cream">
                    {TIME_SLOTS.find((s) => s.id === selectedTime)?.label}
                  </span>
                </div>
                {selectedAddOns.length > 0 && (
                  <div className="pt-2 border-t border-cream/10">
                    <span className="text-xs text-cream/40">Add-ons:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAddOns.map((id) => {
                        const addon = ADD_ONS.find((a) => a.id === id)
                        return (
                          <span key={id} className="text-[10px] bg-cream/5 text-cream/60 px-2 py-0.5 rounded-full">
                            {addon?.icon} {addon?.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Member Code */}
              <div className="glass rounded-xl p-4">
                <label className="text-xs text-cream/40 block mb-2">Member Code (20% off)</label>
                <input
                  type="text"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="500GL..."
                  className="w-full bg-cream/5 rounded-lg px-3 py-2 text-sm text-cream outline-none focus:ring-1 focus:ring-gold/30 transition-all placeholder:text-cream/20"
                />
              </div>

              {/* Price breakdown */}
              <div className="glass-gold rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-cream/60">Subtotal</span>
                  <span className="text-cream">${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-sage-light">Member discount</span>
                    <span className="text-sage-light">-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gold/20">
                  <span className="text-cream">Total</span>
                  <span className="text-gradient-gold">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer Actions ──────────────────── */}
      <div className="p-5 border-t border-cream/10">
        {totals.total > 0 && step !== 'checkout' && (
          <div className="text-right text-xs text-cream/40 mb-2">
            Running total: <span className="text-gold font-medium">${totals.total.toFixed(2)}</span>
          </div>
        )}

        <div className="flex gap-3">
          {step !== 'tier' && (
            <button
              onClick={prevStep}
              className="flex-1 py-3 rounded-xl glass text-sm text-cream/70 hover:text-cream hover:border-cream/20 transition-all"
            >
              Back
            </button>
          )}

          {step === 'checkout' ? (
            <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-dusk font-semibold text-sm hover:brightness-110 transition-all active:scale-[0.98]">
              Confirm Booking
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                canProceed()
                  ? 'bg-gradient-to-r from-gold-dark via-gold to-gold-light text-dusk hover:brightness-110'
                  : 'bg-cream/5 text-cream/30 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
