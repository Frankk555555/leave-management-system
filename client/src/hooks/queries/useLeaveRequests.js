import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveRequestsAPI } from "../../services/api";

// Queries
export const useMyLeaveRequests = () => {
  return useQuery({
    queryKey: ["leaveRequests", "my"],
    queryFn: async () => {
      const response = await leaveRequestsAPI.getMyRequests();
      return response.data;
    },
  });
};

export const useAllLeaveRequests = () => {
  return useQuery({
    queryKey: ["leaveRequests", "all"],
    queryFn: async () => {
      const response = await leaveRequestsAPI.getAll();
      return response.data;
    },
  });
};

export const useTeamLeaveRequests = () => {
  return useQuery({
    queryKey: ["leaveRequests", "team"],
    queryFn: async () => {
      const response = await leaveRequestsAPI.getTeam();
      return response.data;
    },
  });
};

export const usePendingLeaveRequests = () => {
  return useQuery({
    queryKey: ["leaveRequests", "pending"],
    queryFn: async () => {
      const response = await leaveRequestsAPI.getPending();
      return response.data;
    },
  });
};

export const useLeaveRequestById = (id) => {
  return useQuery({
    queryKey: ["leaveRequests", id],
    queryFn: async () => {
      const response = await leaveRequestsAPI.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

// Mutations
export const useCreateLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const response = await leaveRequestsAPI.create(formData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests", "my"] });
    },
  });
};

export const useCancelLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await leaveRequestsAPI.cancel(id, reason);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] });
    },
  });
};

export const useUpdateLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await leaveRequestsAPI.update(id, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] });
    },
  });
};

export const useApproveLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note, comment, decision }) => {
      const payload = typeof note === "object" ? note : { note, comment, decision };
      const response = await leaveRequestsAPI.approve(id, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] });
    },
  });
};

export const useRejectLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await leaveRequestsAPI.reject(id, reason);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] });
    },
  });
};
