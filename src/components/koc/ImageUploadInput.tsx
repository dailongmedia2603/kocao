import { useState, useRef, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Upload } from 'lucide-react';

interface ImageUploadInputProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  initialImageUrl?: string | null;
}

export const ImageUploadInput = ({ form, name, label, initialImageUrl }: ImageUploadInputProps) => {
  const [preview, setPreview] = useState<string | null>(initialImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(initialImageUrl || null);
  }, [initialImageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      form.setValue(name, event.target.files, { shouldValidate: true });
    } else {
      setPreview(initialImageUrl || null);
      form.setValue(name, undefined, { shouldValidate: true });
    }
  };

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
              <Input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/gif"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Tải ảnh lên
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};