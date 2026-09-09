const {
  LeaveLifecycle,
  LifecycleError,
} = require("../services/leaveLifecycleService");
const {
  LeaveRequest,
  User,
  LeaveBalance,
  LeaveHistory,
  LeaveAttachment,
  LeaveType,
  Notification,
} = require("../models");
const { validateLeaveRequest, getFiscalYear } = require("../services/leaveValidationService");
const n8nService = require("../services/n8nService");
const { sequelize } = require("../config/database");

// Mock dependencies
jest.mock("../models", () => ({
  LeaveRequest: {
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn(),
  },
  LeaveBalance: {
    increment: jest.fn(),
    decrement: jest.fn(),
    findOne: jest.fn(),
  },
  LeaveAttachment: {
    create: jest.fn(),
  },
  LeaveType: {
    findOne: jest.fn(),
  },
  Department: {},
  Faculty: {},
  Notification: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  LeaveHistory: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
}));

jest.mock("../services/leaveValidationService", () => ({
  validateLeaveRequest: jest.fn(),
  getFiscalYear: jest.fn().mockReturnValue(2025),
}));

jest.mock("../services/emailService", () => ({
  queueLeaveRequestEmails: jest.fn().mockResolvedValue([]),
  queueApprovalEmail: jest.fn().mockResolvedValue({ id: "job-1" }),
  queueLeaveApprovedAdminNotificationEmails: jest.fn().mockResolvedValue([]),
}));

jest.mock("../services/n8nService", () => ({
  triggerNewLeaveWebhook: jest.fn(),
  triggerLeaveStatusWebhook: jest.fn(),
}));

jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn().mockImplementation(() =>
      Promise.resolve({
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true),
        finished: false,
      })
    ),
  },
}));

describe("LeaveLifecycle Deep Module", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const actor = {
      id: 10,
      firstName: "Somchai",
      lastName: "Dee",
      email: "somchai@bru.ac.th",
      departmentId: 2,
      role: "employee",
    };

    it("should successfully create a leave request with history, balance locking and notifications", async () => {
      validateLeaveRequest.mockResolvedValue({
        valid: true,
        workingDays: 3,
        totalDays: 3,
        countWorkingDaysOnly: true,
      });

      const mockCreated = {
        id: 101,
        userId: 10,
        leaveTypeId: 1,
        totalDays: 3,
        status: "pending",
        user: actor,
        leaveType: { id: 1, name: "ลาป่วย", code: "sick" },
        attachments: [],
        update: jest.fn(),
      };

      LeaveRequest.create.mockResolvedValue(mockCreated);
      LeaveRequest.findByPk.mockResolvedValue(mockCreated);

      const result = await LeaveLifecycle.create(
        {
          leaveTypeId: 1,
          startDate: "2025-03-01",
          endDate: "2025-03-03",
          reason: "ป่วยเป็นไข้หวัด",
        },
        actor
      );

      expect(validateLeaveRequest).toHaveBeenCalled();
      expect(LeaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          leaveTypeId: 1,
          totalDays: 3,
          reason: "ป่วยเป็นไข้หวัด",
        }),
        expect.any(Object)
      );
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveRequestId: 101,
          action: "created",
          actionBy: 10,
          newStatus: "pending",
        }),
        expect.any(Object)
      );
      expect(result.id).toBe(101);
    });

    it("should rollback and throw LifecycleError if business validation fails", async () => {
      validateLeaveRequest.mockResolvedValue({
        valid: false,
        message: "วันลาคงเหลือไม่เพียงพอ",
      });

      await expect(
        LeaveLifecycle.create(
          {
            leaveTypeId: 1,
            startDate: "2025-03-01",
            endDate: "2025-03-10",
          },
          actor
        )
      ).rejects.toThrow("วันลาคงเหลือไม่เพียงพอ");
    });
  });

  describe("transition('approve')", () => {
    it("should allow supervisor of same department to approve pending request", async () => {
      const mockRequest = {
        id: 50,
        userId: 20,
        status: "pending",
        totalDays: 2,
        user: { id: 20, departmentId: 5, firstName: "A", lastName: "B" },
        leaveType: { name: "ลากิจ" },
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const head = { id: 99, role: "head", departmentId: 5 };
      const result = await LeaveLifecycle.transition(50, "approve", head, { note: "อนุมัติครับ" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_dean",
          headApprovedBy: 99,
        }),
        expect.any(Object)
      );
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveRequestId: 50,
          action: "approved",
          actionBy: 99,
          newStatus: "pending_dean",
        }),
        expect.any(Object)
      );
    });

    it("should allow dean to approve pending_dean request to pending_vp", async () => {
      const mockRequest = {
        id: 50,
        userId: 20,
        status: "pending_dean",
        totalDays: 2,
        user: { id: 20, department: { id: 5, facultyId: 2 } },
        leaveType: { name: "ลาพักผ่อน" },
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const dean = { id: 77, role: "dean", department: { id: 10, facultyId: 2 } };
      await LeaveLifecycle.transition(50, "approve", dean, { note: "เห็นชอบ" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_vp",
          deanApprovedBy: 77,
        }),
        expect.any(Object)
      );
    });

    it("should allow vp to issue command on pending_vp request to approved", async () => {
      const mockRequest = {
        id: 50,
        userId: 20,
        status: "pending_vp",
        totalDays: 2,
        user: { id: 20, department: { id: 5, facultyId: 2 } },
        leaveType: { name: "ลาพักผ่อน" },
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const vp = { id: 66, role: "vp" };
      await LeaveLifecycle.transition(50, "approve", vp, { note: "อนุญาต", decision: "allow" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "approved",
          vpDecision: "allow",
          vpApprovedBy: 66,
        }),
        expect.any(Object)
      );
    });

    it("should deny self-approval by non-admin", async () => {
      const mockRequest = {
        id: 51,
        userId: 99, // Same as actor
        status: "pending",
        user: { id: 99, departmentId: 5 },
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const head = { id: 99, role: "head", departmentId: 5 };
      await expect(
        LeaveLifecycle.transition(51, "approve", head)
      ).rejects.toThrow("ไม่อนุญาตให้อนุมัติใบลาของตนเอง");
    });

    it("should deny approval by head from different department", async () => {
      const mockRequest = {
        id: 52,
        userId: 30,
        status: "pending",
        user: { id: 30, departmentId: 5 },
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const foreignHead = { id: 88, role: "head", departmentId: 9 };
      await expect(
        LeaveLifecycle.transition(52, "approve", foreignHead)
      ).rejects.toThrow("ไม่มีสิทธิ์อนุมัติใบลาของบุคลากรต่างแผนก/สาขาวิชา");
    });
  });

  describe("transition('reject')", () => {
    it("should reject pending request with reason", async () => {
      const mockRequest = {
        id: 60,
        userId: 20,
        status: "pending",
        totalDays: 2,
        user: { id: 20, departmentId: 5 },
        leaveType: { name: "ลาพักผ่อน" },
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const head = { id: 99, role: "head", departmentId: 5 };
      await LeaveLifecycle.transition(60, "reject", head, { reason: "งานด่วนไม่สามารถลาได้" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "rejected",
          approvedBy: 99,
          rejectionReason: "งานด่วนไม่สามารถลาได้",
        }),
        expect.any(Object)
      );
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "rejected",
          note: "งานด่วนไม่สามารถลาได้",
        }),
        expect.any(Object)
      );
    });

    it("should throw error if reason is missing", async () => {
      const mockRequest = { id: 61, status: "pending", user: { departmentId: 5 } };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const head = { id: 99, role: "head", departmentId: 5 };
      await expect(
        LeaveLifecycle.transition(61, "reject", head, {})
      ).rejects.toThrow("กรุณาระบุเหตุผลการปฏิเสธ");
    });
  });

  describe("transition('confirm')", () => {
    it("should deduct leave balance and confirm approved request", async () => {
      const mockRequest = {
        id: 70,
        userId: 20,
        leaveTypeId: 3,
        startDate: "2025-04-10",
        totalDays: 2.5,
        status: "approved",
        user: { id: 20, firstName: "Somchai" },
        leaveType: { name: "ลาพักผ่อน" },
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);
      getFiscalYear.mockReturnValue(2025);

      const admin = { id: 1, role: "admin" };
      await LeaveLifecycle.transition(70, "confirm", admin, { note: "ลงบันทึกในระบบแล้ว" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "confirmed",
          confirmedBy: 1,
          confirmedNote: "ลงบันทึกในระบบแล้ว",
        }),
        expect.any(Object)
      );
      expect(LeaveBalance.increment).toHaveBeenCalledWith(
        "usedDays",
        expect.objectContaining({
          by: 2.5,
          where: {
            userId: 20,
            leaveTypeId: 3,
            year: 2025,
          },
        })
      );
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "confirmed",
          actionBy: 1,
        }),
        expect.any(Object)
      );
    });

    it("should reject confirm if request is still pending", async () => {
      const mockRequest = { id: 71, status: "pending" };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const admin = { id: 1, role: "admin" };
      await expect(
        LeaveLifecycle.transition(71, "confirm", admin)
      ).rejects.toThrow("สามารถยืนยันใบลาได้เฉพาะใบที่ผ่านการอนุมัติ");
    });
  });

  describe("transition('cancel')", () => {
    it("should cancel confirmed request and restore leave balance", async () => {
      const mockRequest = {
        id: 80,
        userId: 20,
        leaveTypeId: 2,
        startDate: "2025-05-01",
        totalDays: 3,
        status: "confirmed",
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);
      getFiscalYear.mockReturnValue(2025);

      const owner = { id: 20, role: "employee" };
      await LeaveLifecycle.transition(80, "cancel", owner, { reason: "ขอยกเลิกเนื่องจากติดภารกิจ" });

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          cancelReason: "ขอยกเลิกเนื่องจากติดภารกิจ",
        }),
        expect.any(Object)
      );
      expect(LeaveBalance.decrement).toHaveBeenCalledWith(
        "usedDays",
        expect.objectContaining({
          by: 3,
          where: {
            userId: 20,
            leaveTypeId: 2,
            year: 2025,
          },
        })
      );
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "cancelled",
          actionBy: 20,
          oldStatus: "confirmed",
          newStatus: "cancelled",
        }),
        expect.any(Object)
      );
    });

    it("should cancel pending request without modifying balance", async () => {
      const mockRequest = {
        id: 81,
        userId: 20,
        leaveTypeId: 2,
        status: "pending",
        totalDays: 1,
        update: jest.fn().mockResolvedValue(true),
      };
      LeaveRequest.findByPk.mockResolvedValue(mockRequest);

      const owner = { id: 20, role: "employee" };
      await LeaveLifecycle.transition(81, "cancel", owner);

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        }),
        expect.any(Object)
      );
      expect(LeaveBalance.decrement).not.toHaveBeenCalled();
    });
  });
});
