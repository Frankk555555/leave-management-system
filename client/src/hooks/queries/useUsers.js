import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersAPI } from "../../services/api";

export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await usersAPI.getAll();
      return response.data;
    },
  });
};

export const useSupervisors = () => {
  return useQuery({
    queryKey: ["users", "supervisors"],
    queryFn: async () => {
      const response = await usersAPI.getSupervisors();
      return response.data;
    },
  });
};

export const useUserById = (id) => {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const response = await usersAPI.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await usersAPI.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, ...rest }) => {
      const payload = data !== undefined ? data : rest;
      const response = await usersAPI.update(id, payload);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await usersAPI.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};
