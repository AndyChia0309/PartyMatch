import ExploreGroupCard from "../../explore/components/ExploreGroupCard";
import { getServiceById } from "../../../common/utils/serviceUtils";
import { useAuthStore } from "../../../common/stores/useAuthStore";
import { buildPreviewGroupId } from "../utils/previewGroupId";

export default function LivePreviewPanel({ form }) {
  const service = getServiceById(form.serviceId);
  const user = useAuthStore(s => s.user);
  const activeUser = user ? useAuthStore.getState().getProfile() : null;

  const group = {
    id: buildPreviewGroupId(form),
    serviceId: form.serviceId,
    serviceName: service?.name ?? form.serviceId ?? "",
    planName: form.planName || "尚未選擇方案",
    pricePerSeat: form.pricePerSeat || 0,
    billingCycle: form.billingCycle,
    totalSeats: form.planName ? form.recruitHeadcount : null,
    usedSeats: form.planName ? 1 : 0,
    openSeats: form.planName ? Math.max(form.recruitHeadcount - 1, 0) : null,
    tags: [service?.category].filter(Boolean),
    hostName: activeUser?.displayName ?? "使用者",
    hostAvatarColor: activeUser?.avatarColor ?? null,
    hostAvatarInitial: activeUser?.avatarInitial ?? "",
    hostRating: null,
    status: "recruiting",
  };

  return (
    <div className="pointer-events-none">
      <ExploreGroupCard group={group} hideActions />
    </div>
  );
}
