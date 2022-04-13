export const getRandomColor = () => {
  const R = Math.floor(Math.random() * 2)
  const G = Math.floor(Math.random() * 2)
  const B = Math.floor(Math.random() * 2)
  const color = `#${R === 0 ? '0' : 'f'}${G === 0 ? '0' : 'f'}${
    B === 0 ? '0' : 'f'}`
  if (color == '#fff') {
    return '#000'
  }
  return color
}
