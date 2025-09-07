import { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from 'lucide-react';

interface ImageUploadInputProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  initialImageUrl?: string | null;
}

export const ImageUploadInput = ({ form, name, label, initialImageUrl }: ImageUploadInputProps) => {
  const [preview, setPreview] = useState<string | null>(initialImageUrl || null);

  useEffect(() => {
    setPreview(initialImageUrl || null);
  }, [initialImageUrl]);

  return (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={preview || undefined} className="object-cover" />
                <AvatarFallback>
                  <User className="h-10 w-10 text-gray-400" />
                </AvatarFallback>
              </Avatar>
              {/* Input and Upload Button have been removed */}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};