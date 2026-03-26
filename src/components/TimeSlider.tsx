interface TimeSliderProps {
  minYear: number
  maxYear: number
  value: [number, number]
  onChange: (value: [number, number]) => void
}

export default function TimeSlider({ minYear, maxYear, value, onChange }: TimeSliderProps) {
  return (
    <div className="time-slider-wrap">
      <div className="time-slider-head">
        Time mode · {value[0]} → {value[1]}
      </div>
      <input
        className="time-slider"
        type="range"
        min={minYear}
        max={maxYear}
        value={value[0]}
        onChange={(e) => onChange([Number(e.target.value), value[1]])}
      />
      <input
        className="time-slider"
        type="range"
        min={minYear}
        max={maxYear}
        value={value[1]}
        onChange={(e) => onChange([value[0], Number(e.target.value)])}
      />
    </div>
  )
}
