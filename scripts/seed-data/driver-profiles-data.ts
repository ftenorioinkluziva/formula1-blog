export interface DriverProfile {
  name: string
  shortName: string
  number: number
  team: string
  teamColor: string
  nationality: string
  flag: string
  points: number
  position: number
  wins: number
  podiums: number
  poles: number
  championships: number
  dob: string
  pob: string
}

export interface DriverCareerStat {
  gpEntered: number
  careerPoints: string
  bestFinish: string
  bestGrid: string
  dnfs: number
}

export const driverProfiles: DriverProfile[] = [
  { name: "Lando Norris", shortName: "NOR", number: 1, team: "McLaren", teamColor: "#FF8000", nationality: "British", flag: "🇬🇧", points: 0, position: 1, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "13/11/1999", pob: "Bristol, England" },
  { name: "Max Verstappen", shortName: "VER", number: 3, team: "Red Bull Racing", teamColor: "#3671C6", nationality: "Dutch", flag: "🇳🇱", points: 0, position: 2, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "30/09/1997", pob: "Hasselt, Belgium" },
  { name: "Oscar Piastri", shortName: "PIA", number: 81, team: "McLaren", teamColor: "#FF8000", nationality: "Australian", flag: "🇦🇺", points: 0, position: 3, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "06/04/2001", pob: "Melbourne, Australia" },
  { name: "George Russell", shortName: "RUS", number: 63, team: "Mercedes", teamColor: "#27F4D2", nationality: "British", flag: "🇬🇧", points: 0, position: 4, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "15/02/1998", pob: "King's Lynn, England" },
  { name: "Charles Leclerc", shortName: "LEC", number: 16, team: "Ferrari", teamColor: "#E8002D", nationality: "Monégasque", flag: "🇲🇨", points: 0, position: 5, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "16/10/1997", pob: "Monte Carlo, Monaco" },
  { name: "Lewis Hamilton", shortName: "HAM", number: 44, team: "Ferrari", teamColor: "#E8002D", nationality: "British", flag: "🇬🇧", points: 0, position: 6, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "07/01/1985", pob: "Stevenage, England" },
  { name: "Kimi Antonelli", shortName: "ANT", number: 12, team: "Mercedes", teamColor: "#27F4D2", nationality: "Italian", flag: "🇮🇹", points: 0, position: 7, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "25/08/2006", pob: "Bologna, Italy" },
  { name: "Alexander Albon", shortName: "ALB", number: 23, team: "Williams", teamColor: "#64C4FF", nationality: "Thai", flag: "🇹🇭", points: 0, position: 8, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "23/03/1996", pob: "London, England" },
  { name: "Carlos Sainz", shortName: "SAI", number: 55, team: "Williams", teamColor: "#64C4FF", nationality: "Spanish", flag: "🇪🇸", points: 0, position: 9, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "01/09/1994", pob: "Madrid, Spain" },
  { name: "Fernando Alonso", shortName: "ALO", number: 14, team: "Aston Martin", teamColor: "#229971", nationality: "Spanish", flag: "🇪🇸", points: 0, position: 10, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "29/07/1981", pob: "Oviedo, Spain" },
  { name: "Nico Hülkenberg", shortName: "HUL", number: 27, team: "Audi", teamColor: "#C00000", nationality: "German", flag: "🇩🇪", points: 0, position: 11, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "19/08/1987", pob: "Emmerich, Germany" },
  { name: "Isack Hadjar", shortName: "HAD", number: 6, team: "Red Bull Racing", teamColor: "#3671C6", nationality: "French", flag: "🇫🇷", points: 0, position: 12, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "28/09/2004", pob: "Paris, France" },
  { name: "Oliver Bearman", shortName: "BEA", number: 87, team: "Haas F1 Team", teamColor: "#B6BABD", nationality: "British", flag: "🇬🇧", points: 0, position: 13, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "08/05/2005", pob: "Chelmsford, England" },
  { name: "Liam Lawson", shortName: "LAW", number: 30, team: "Racing Bulls", teamColor: "#6692FF", nationality: "New Zealander", flag: "🇳🇿", points: 0, position: 14, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "11/02/2002", pob: "Hastings, New Zealand" },
  { name: "Esteban Ocon", shortName: "OCO", number: 31, team: "Haas F1 Team", teamColor: "#B6BABD", nationality: "French", flag: "🇫🇷", points: 0, position: 15, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "17/09/1996", pob: "Évreux, France" },
  { name: "Lance Stroll", shortName: "STR", number: 18, team: "Aston Martin", teamColor: "#229971", nationality: "Canadian", flag: "🇨🇦", points: 0, position: 16, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "29/10/1998", pob: "Montreal, Canada" },
  { name: "Pierre Gasly", shortName: "GAS", number: 10, team: "Alpine", teamColor: "#FF87BC", nationality: "French", flag: "🇫🇷", points: 0, position: 17, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "07/02/1996", pob: "Rouen, France" },
  { name: "Gabriel Bortoleto", shortName: "BOR", number: 5, team: "Audi", teamColor: "#C00000", nationality: "Brazilian", flag: "🇧🇷", points: 0, position: 18, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "14/10/2004", pob: "São Paulo, Brazil" },
  { name: "Franco Colapinto", shortName: "COL", number: 43, team: "Alpine", teamColor: "#FF87BC", nationality: "Argentine", flag: "🇦🇷", points: 0, position: 19, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "27/05/2003", pob: "Buenos Aires, Argentina" },
  { name: "Arvid Lindblad", shortName: "LIN", number: 41, team: "Racing Bulls", teamColor: "#6692FF", nationality: "British", flag: "🇬🇧", points: 0, position: 20, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "08/08/2007", pob: "London, England" },
  { name: "Sergio Pérez", shortName: "PER", number: 11, team: "Cadillac", teamColor: "#FFFFFF", nationality: "Mexican", flag: "🇲🇽", points: 0, position: 21, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "26/01/1990", pob: "Guadalajara, Mexico" },
  { name: "Valtteri Bottas", shortName: "BOT", number: 77, team: "Cadillac", teamColor: "#FFFFFF", nationality: "Finnish", flag: "🇫🇮", points: 0, position: 22, wins: 0, podiums: 0, poles: 0, championships: 0, dob: "28/08/1989", pob: "Nastola, Finland" },
]

export const driverCareerStats: Record<string, DriverCareerStat> = {
  "Lando Norris": { gpEntered: 152, careerPoints: "1430", bestFinish: "1 (x11)", bestGrid: "1 (x16)", dnfs: 13 },
  "Max Verstappen": { gpEntered: 233, careerPoints: "3444.5", bestFinish: "1 (x71)", bestGrid: "1 (x48)", dnfs: 33 },
  "Oscar Piastri": { gpEntered: 70, careerPoints: "799", bestFinish: "1 (x9)", bestGrid: "1 (x6)", dnfs: 4 },
  "George Russell": { gpEntered: 152, careerPoints: "1033", bestFinish: "1 (x5)", bestGrid: "1 (x8)", dnfs: 16 },
  "Charles Leclerc": { gpEntered: 171, careerPoints: "1672", bestFinish: "1 (x8)", bestGrid: "1 (x27)", dnfs: 23 },
  "Lewis Hamilton": { gpEntered: 380, careerPoints: "5018.5", bestFinish: "1 (x105)", bestGrid: "1 (x104)", dnfs: 34 },
  "Kimi Antonelli": { gpEntered: 24, careerPoints: "150", bestFinish: "2 (x1)", bestGrid: "2 (x1)", dnfs: 4 },
  "Alexander Albon": { gpEntered: 128, careerPoints: "313", bestFinish: "3 (x2)", bestGrid: "4 (x5)", dnfs: 17 },
  "Carlos Sainz": { gpEntered: 230, careerPoints: "1336.5", bestFinish: "1 (x4)", bestGrid: "1 (x6)", dnfs: 42 },
  "Fernando Alonso": { gpEntered: 427, careerPoints: "2393", bestFinish: "1 (x32)", bestGrid: "1 (x22)", dnfs: 83 },
  "Nico Hülkenberg": { gpEntered: 251, careerPoints: "622", bestFinish: "3 (x1)", bestGrid: "1 (x1)", dnfs: 44 },
  "Isack Hadjar": { gpEntered: 23, careerPoints: "51", bestFinish: "3 (x1)", bestGrid: "4 (x1)", dnfs: 2 },
  "Oliver Bearman": { gpEntered: 27, careerPoints: "48", bestFinish: "4 (x1)", bestGrid: "8 (x2)", dnfs: 3 },
  "Liam Lawson": { gpEntered: 35, careerPoints: "44", bestFinish: "5 (x1)", bestGrid: "3 (x1)", dnfs: 6 },
  "Esteban Ocon": { gpEntered: 180, careerPoints: "483", bestFinish: "1 (x1)", bestGrid: "3 (x3)", dnfs: 25 },
  "Lance Stroll": { gpEntered: 190, careerPoints: "325", bestFinish: "3 (x3)", bestGrid: "1 (x1)", dnfs: 31 },
  "Pierre Gasly": { gpEntered: 177, careerPoints: "458", bestFinish: "1 (x1)", bestGrid: "2 (x1)", dnfs: 26 },
  "Gabriel Bortoleto": { gpEntered: 24, careerPoints: "19", bestFinish: "6 (x1)", bestGrid: "7 (x3)", dnfs: 5 },
  "Franco Colapinto": { gpEntered: 27, careerPoints: "5", bestFinish: "8 (x1)", bestGrid: "8 (x1)", dnfs: 3 },
  "Arvid Lindblad": { gpEntered: 0, careerPoints: "0", bestFinish: "—", bestGrid: "—", dnfs: 0 },
  "Sergio Pérez": { gpEntered: 281, careerPoints: "1638", bestFinish: "1 (x6)", bestGrid: "1 (x3)", dnfs: 39 },
  "Valtteri Bottas": { gpEntered: 246, careerPoints: "1797", bestFinish: "1 (x10)", bestGrid: "1 (x20)", dnfs: 28 },
}
