"use client"

const TIMEZONES: { group: string; zones: { value: string; label: string }[] }[] = [
  {
    group: "United States",
    zones: [
      { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
      { value: "America/Anchorage", label: "Alaska (AKST)" },
      { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
      { value: "America/Phoenix", label: "Arizona (MST)" },
      { value: "America/Denver", label: "Mountain (MST/MDT)" },
      { value: "America/Chicago", label: "Central (CST/CDT)" },
      { value: "America/New_York", label: "Eastern (EST/EDT)" },
    ],
  },
  {
    group: "Americas",
    zones: [
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    ],
  },
  {
    group: "Europe",
    zones: [
      { value: "UTC", label: "UTC" },
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    ],
  },
  {
    group: "Asia / Pacific",
    zones: [
      { value: "Asia/Kolkata", label: "India (IST)" },
      { value: "Asia/Shanghai", label: "China (CST)" },
      { value: "Asia/Tokyo", label: "Tokyo (JST)" },
      { value: "Australia/Sydney", label: "Sydney (AEST)" },
    ],
  },
]

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
}

export default function TimezoneSelect({ value, onChange, id, className }: TimezoneSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ||
        "w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      }
    >
      {TIMEZONES.map((group) => (
        <optgroup key={group.group} label={group.group}>
          {group.zones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
