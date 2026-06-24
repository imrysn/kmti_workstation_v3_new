import AddJobModal from './modals/AddJobModal'
import AddComponentModal from './modals/AddComponentModal'
import EditComponentModal from './modals/EditComponentModal'
import TimelineCellModal from './modals/TimelineCellModal'
import TimelineSpanModal from './modals/TimelineSpanModal'
import EmployeeModal from './modals/EmployeeModal'
import EditJobModal from './modals/EditJobModal'

export default function ScheduleModals() {
  return (
    <>
      <AddJobModal />
      <AddComponentModal />
      <EditComponentModal />
      <TimelineCellModal />
      <TimelineSpanModal />
      <EmployeeModal />
      <EditJobModal />
    </>
  )
}
