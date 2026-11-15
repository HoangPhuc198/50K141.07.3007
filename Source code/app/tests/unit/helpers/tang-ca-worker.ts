import { prisma } from "@database/client";
import {
  layCaHomNayCuaNhanVien,
  thucHienCheckIn,
  thucHienCheckOut,
} from "@backend/services/cham-cong";
import { getThongBaoTheoPhien } from "@backend/services/thong-bao";

type WorkerAction =
  | "check-in"
  | "start-ot"
  | "hom-nay"
  | "checkout-early"
  | "poll-thong-bao";

async function main() {
  const action = process.argv[2] as WorkerAction | undefined;
  const manv = process.argv[3] || "NV000001";
  const malich = process.argv[4];

  if (!action) {
    throw new Error("Missing action argument");
  }

  let data: unknown;
  switch (action) {
    case "check-in":
      data = await thucHienCheckIn(manv, malich);
      break;
    case "start-ot":
      data = await thucHienCheckOut(manv, true, malich);
      break;
    case "hom-nay":
      data = await layCaHomNayCuaNhanVien(manv);
      break;
    case "checkout-early":
      data = await thucHienCheckOut(manv, false, malich);
      break;
    case "poll-thong-bao":
      data = await getThongBaoTheoPhien({
        userId: manv,
        username: manv,
        role: "NhanVien",
        name: manv,
      });
      break;
    default:
      throw new Error(`Unsupported action: ${String(action)}`);
  }

  process.stdout.write(
    `${JSON.stringify({ pid: process.pid, data })}\n`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
