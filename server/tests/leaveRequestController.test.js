const {
  getLeaveRequestById,
  approveLeaveRequest,
  rejectLeaveRequest,
  confirmLeaveRequest,
} = require("../controllers/leaveRequestController");
const { LeaveRequest } = require("../models");

// Mocking models
jest.mock("../models", () => {
  return {
    LeaveRequest: {
      findByPk: jest.fn(),
    },
    User: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    LeaveBalance: {},
    LeaveAttachment: {},
    LeaveType: {},
    Department: {},
    Faculty: {},
    Notification: {
      create: jest.fn(),
    },
    LeaveHistory: {
      create: jest.fn(),
    },
  };
});
jest.mock("../services/leaveValidationService", () => ({
  getFiscalYear: jest.fn().mockReturnValue(2024),
}));
jest.mock("../services/emailService", () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue(true),
  sendLeaveApprovedAdminNotificationEmail: jest.fn().mockResolvedValue(true),
  sendLeaveRequestEmail: jest.fn().mockResolvedValue(true),
  queueLeaveRequestEmails: jest.fn().mockResolvedValue([]),
  queueApprovalEmail: jest.fn().mockResolvedValue({ id: "mock-job" }),
  queueLeaveApprovedAdminNotificationEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock("../services/n8nService", () => ({
  triggerLeaveStatusWebhook: jest.fn(),
}));
jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn(),
      rollback: jest.fn(),
    }),
  },
}));

describe("leaveRequestController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getLeaveRequestById (IDOR Check)", () => {
    let req, res;

    beforeEach(() => {
      req = {
        params: { id: 1 },
        user: {}, // Will be set in each test
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it("should return 404 if leave request is not found", async () => {
      LeaveRequest.findByPk.mockResolvedValue(null);

      await getLeaveRequestById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Leave request not found" });
    });

    it("should allow access if user is the OWNER", async () => {
      req.user = { id: 1, role: "employee" };
      LeaveRequest.findByPk.mockResolvedValue({
        id: 100,
        userId: 1, // Owner matches req.user.id
      });

      await getLeaveRequestById(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
    });

    it("should allow access if user is an ADMIN", async () => {
      req.user = { id: 99, role: "admin" };
      LeaveRequest.findByPk.mockResolvedValue({
        id: 100,
        userId: 1, // Different owner
      });

      await getLeaveRequestById(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
    });

    it("should allow access if user is HEAD of the SAME department", async () => {
      req.user = { id: 99, role: "head", departmentId: 5 }; // Head of department 5
      LeaveRequest.findByPk.mockResolvedValue({
        id: 100,
        userId: 1, // Different owner
        user: {
          department: {
            id: 5, // Same department as head
          },
        },
      });

      await getLeaveRequestById(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
    });

    it("should DENY access (403) if user is HEAD of a DIFFERENT department", async () => {
      req.user = { id: 99, role: "head", departmentId: 5 }; // Head of department 5
      LeaveRequest.findByPk.mockResolvedValue({
        id: 100,
        userId: 1, // Different owner
        user: {
          department: {
            id: 2, // Different department!
          },
        },
      });

      await getLeaveRequestById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "ไม่มีสิทธิ์เข้าถึงใบลานี้" });
    });

    it("should DENY access (403) if user is just another regular employee", async () => {
      req.user = { id: 2, role: "employee" }; // Regular employee
      LeaveRequest.findByPk.mockResolvedValue({
        id: 100,
        userId: 1, // Different owner
        user: {
          department: { id: 2 },
        },
      });

      await getLeaveRequestById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "ไม่มีสิทธิ์เข้าถึงใบลานี้" });
    });
  });

  describe("approveLeaveRequest (Department Isolation & Anti Self-Approval)", () => {
    let req, res;

    beforeEach(() => {
      req = {
        params: { id: 1 },
        body: { note: "Approved by head" },
        user: { id: 50, role: "head", departmentId: 5 },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it("should DENY approval (403) if head tries to approve OWN leave request", async () => {
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        userId: 50, // Same as req.user.id
        user: { id: 50, departmentId: 5 },
      });

      await approveLeaveRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ไม่อนุญาตให้อนุมัติใบลาของตนเอง (กรุณาให้ผู้ดูแลระบบเป็นผู้อนุมัติ)",
        })
      );
    });

    it("should DENY approval (403) if head is from a DIFFERENT department", async () => {
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        userId: 10,
        user: { id: 10, departmentId: 9 }, // Different department (9 != 5)
      });

      await approveLeaveRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ไม่มีสิทธิ์อนุมัติใบลาของบุคลากรต่างแผนก/สาขาวิชา",
        })
      );
    });

    it("should ALLOW approval (200) if head is from the SAME department", async () => {
      const mockUpdate = jest.fn();
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        totalDays: 2,
        userId: 10,
        user: { id: 10, departmentId: 5, firstName: "Emp", lastName: "Loyee" },
        leaveType: { name: "ลาพักผ่อน" },
        update: mockUpdate,
      });

      await approveLeaveRequest(req, res);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_dean",
          headApprovedBy: 50,
        }),
        expect.anything()
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "อนุมัติคำขอลาเรียบร้อยแล้ว",
        })
      );
    });

    it("should ALLOW approval (200) if user is an ADMIN regardless of department", async () => {
      req.user = { id: 99, role: "admin" };
      const mockUpdate = jest.fn();
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        totalDays: 2,
        userId: 10,
        user: { id: 10, departmentId: 9, firstName: "Emp", lastName: "Loyee" },
        leaveType: { name: "ลาพักผ่อน" },
        update: mockUpdate,
      });

      await approveLeaveRequest(req, res);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_dean",
          headApprovedBy: 99,
        }),
        expect.anything()
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "อนุมัติคำขอลาเรียบร้อยแล้ว",
        })
      );
    });
  });

  describe("rejectLeaveRequest (Department Isolation & Anti Self-Rejection)", () => {
    let req, res;

    beforeEach(() => {
      req = {
        params: { id: 1 },
        body: { reason: "Urgent tasks pending" },
        user: { id: 50, role: "head", departmentId: 5 },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it("should DENY rejection (403) if head is from a DIFFERENT department", async () => {
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        userId: 10,
        user: { id: 10, departmentId: 8 },
      });

      await rejectLeaveRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ไม่มีสิทธิ์ปฏิเสธใบลาของบุคลากรต่างแผนก/สาขาวิชา",
        })
      );
    });

    it("should ALLOW rejection (200) if head is from the SAME department", async () => {
      const mockUpdate = jest.fn();
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending",
        totalDays: 1,
        userId: 10,
        user: { id: 10, departmentId: 5, firstName: "Emp" },
        leaveType: { name: "ลากิจ" },
        update: mockUpdate,
      });

      await rejectLeaveRequest(req, res);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "rejected",
          approvedBy: 50,
          rejectionReason: "Urgent tasks pending",
        }),
        expect.anything()
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ปฏิเสธคำขอลาเรียบร้อยแล้ว",
        })
      );
    });
  });

  describe("confirmLeaveRequest (Balance Deduction)", () => {
    let req, res;
    const { LeaveBalance, Notification, LeaveHistory } = require("../models");
    const { sequelize } = require("../config/database");

    beforeEach(() => {
      req = {
        params: { id: 1 },
        user: { id: 99, role: "admin" }, // Admin confirming
        body: { note: "Approved and filed" },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      LeaveBalance.increment = jest.fn();
      Notification.create = jest.fn();
      LeaveHistory.create = jest.fn();
    });

    it("should return 400 if leave is not 'approved' status", async () => {
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "pending", // Not approved!
      });

      await confirmLeaveRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "สามารถยืนยันใบลาได้เฉพาะใบที่ผ่านการอนุมัติจากหัวหน้างานมาแล้วเท่านั้น",
      });
    });

    it("should successfully confirm, deduct balance securely via transaction, and create history", async () => {
      const mockUpdate = jest.fn();
      LeaveRequest.findByPk.mockResolvedValue({
        id: 1,
        status: "approved",
        totalDays: 2.5,
        userId: 1,
        leaveTypeId: 1,
        update: mockUpdate,
        user: { firstName: "Test", email: "test@example.com" },
      });

      const mockTx = { commit: jest.fn(), rollback: jest.fn() };
      sequelize.transaction.mockResolvedValue(mockTx);

      await confirmLeaveRequest(req, res);

      // Verify transaction was used in update and increment
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "confirmed", confirmedBy: 99 }),
        { transaction: mockTx }
      );
      expect(LeaveBalance.increment).toHaveBeenCalledWith(
        "usedDays",
        expect.objectContaining({
          by: 2.5,
          where: { userId: 1, leaveTypeId: 1, year: 2024 },
          transaction: mockTx,
        })
      );

      // Verify transaction was committed
      expect(mockTx.commit).toHaveBeenCalled();

      // Verify Audit history & Notification
      expect(LeaveHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveRequestId: 1,
          action: "confirmed",
          newStatus: "confirmed",
        }),
        expect.anything()
      );
      expect(Notification.create).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ยืนยันการลงข้อมูลเรียบร้อยแล้ว",
        })
      );
    });
  });
});
