import { AppProvider } from './context/AppContext'
import MapComponent from './components/MapComponent'

export default function App() {
  return (
    <AppProvider>
      <MapComponent />
    </AppProvider>
  )
}
