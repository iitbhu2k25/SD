// app/vector/components/analysis.tsx
import React, { useState } from "react";
import { useEffect, useRef } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDraggable,
    Select,
    SelectItem,
    Checkbox,
    Tooltip,
    Input
} from "@heroui/react";
interface UimodalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}
interface UploadedLayer {
    value: string;
    label: string;
    files?: {
        shp: File;
        dbf: File;
    };
}
export default function UidModal({ isOpen, onOpenChange }: UimodalProps) {
    const targetRef = React.useRef<HTMLElement | null>(null);

    const { moveProps } = useDraggable({
        targetRef: targetRef as React.RefObject<HTMLElement>,

        canOverflow: true,
        isDisabled: !isOpen
    });


    // States for form controls
    const [preserveAttributes, setPreserveAttributes] = useState(true);
    const [outputName, setOutputName] = useState("");
    const [uploadedLayers, setUploadedLayers] = useState<UploadedLayer[]>([]);
    const [selectedLayers, setSelectedLayers] = useState(new Set());

    // Sample existing layer options
    const existingLayerOptions = [
        { value: "administrative_district", label: "Administrative - District" },
        { value: "watershed_varuna", label: "Watershed - Varuna" },
        { value: "rivers_all", label: "Rivers - All" },
        { value: "canals_all", label: "Canals - All" },
    ];

    // Handle file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        const shpFile = files.find(file => file.name.endsWith('.shp'));
        const dbfFile = files.find(file => file.name.endsWith('.dbf'));

        if (shpFile && dbfFile) {
            const layerName = shpFile.name.replace('.shp', '');
            const newLayer = {
                value: `${layerName}_${Date.now()}`, // Unique value for uploaded files
                label: `Uploaded - ${layerName}`,
                files: { shp: shpFile, dbf: dbfFile }
            };
            setUploadedLayers(prev => [...prev, newLayer]);
            event.target.value = '';
        } else {
            alert('Please upload both .shp and .dbf files');
        }
    };

    // Handle layer selection
    const toggleLayerSelection = (layerValue: string) => {
        const newSelected = new Set(selectedLayers);
        if (newSelected.has(layerValue)) {
            newSelected.delete(layerValue);
        } else {
            newSelected.add(layerValue);
        }
        setSelectedLayers(newSelected);
    };

    // Handle adding existing data
    const handleAddExisting = (value: String) => {
        const layer = existingLayerOptions.find(opt => opt.value === value);
        if (layer) {
            // Create a unique instance of the layer by appending a timestamp
            const uniqueLayer = {
                value: `${layer.value}_${Date.now()}`, // Ensure uniqueness
                label: layer.label,
            };
            setUploadedLayers(prev => [...prev, uniqueLayer]);
        }
    };

    const handleUnion = () => {
        console.log("Performing union with:", {
            preserveAttributes,
            outputName,
            selectedLayers: Array.from(selectedLayers)
        });
        onOpenChange(false);
    };

    return (
        <Modal
            ref={targetRef}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="lg"
            placement="center"
            classNames={{
                base: "max-w-lg mx-auto bg-white",
                header: "border-b border-gray-200 pb-2",
                body: "py-4",
                footer: "border-t border-gray-200 pt-2"
            }}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader
                            {...moveProps}
                            className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-t-lg"
                        >
                            <i className="fas fa-object-group mr-1"></i>
                            Union Tool
                            <Tooltip content="Combine selected spatial layers into one">
                                <i className="fas fa-question-circle text-blue-500 text-sm ml-5 cursor-help"></i>
                            </Tooltip>
                        </ModalHeader>

                        <ModalBody>
                            <div className="space-y-6">
                                {/* File Upload Section */}
                                <div>
                                    <label className="block text-sm font-medium text-violet-700 mb-1">
                                        Upload Shapefile
                                    </label>

                                    <Input
                                        type="file"
                                        accept=".shp,.dbf"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="w-full text-sm  overflow-y-auto border border-blue-200 rounded-md  "
                                    />

                                    <p className="text-xs text-gray-500 mt-1">
                                        Upload both .shp and .dbf files together
                                    </p>
                                </div>

                                {/* Layer List with Checkboxes */}
                                <div>
                                    <label className="block text-sm font-medium text-violet-700 mb-1">
                                        Layer List
                                    </label>
                                    <div className="w-full text-sm  overflow-y-auto border border-blue-200 rounded-md">
                                        {uploadedLayers.map((layer) => (
                                            <div key={layer.value} className="flex items-center py-1">
                                                <Checkbox
                                                    checked={selectedLayers.has(layer.value)}
                                                    onChange={() => toggleLayerSelection(layer.value)}
                                                    size="sm"
                                                    className="w-4 h-4"
                                                />
                                                <label className="ml-2 text-sm text-gray-700">
                                                    {layer.label}
                                                </label>
                                            </div>
                                        ))}
                                        {uploadedLayers.length === 0 && (
                                            <p className="text-sm text-gray-500">No layers added yet</p>
                                        )}
                                    </div>
                                </div>

                                {/* Add Existing Data */}
                                <div>
                                    <label className="block text-sm font-medium text-violet-700 mb-1">
                                        Add Existing Data
                                    </label>
                                    <Select
                                        // placeholder="Select existing layer"
                                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => handleAddExisting(event.target.value)}
                                        className="w-full bg-white text-black border border-blue-300 px-0.5"
                                        size="sm"
                                    >
                                        {existingLayerOptions.map((layer) => (
                                            <option
                                                key={layer.value}
                                                value={layer.value}
                                                className="bg-white text-black hover:bg-gray-100"
                                            >
                                                {layer.label}
                                            </option>
                                        ))}
                                    </Select>
                                </div>



                                {/* Output Name */}
                                <div>
                                    <label className="block text-sm font-medium text-violet-700 mb-1">
                                        Output Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter output layer name"
                                        value={outputName}
                                        onChange={(e) => setOutputName(e.target.value)}
                                        className="w-full p-2 text-sm border border-violet-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <Checkbox
                                        checked={preserveAttributes}
                                        onChange={() => setPreserveAttributes(!preserveAttributes)}
                                        size="sm"
                                        className="w-4 h-4"
                                    />
                                    <label className="ml-4 text-sm text-gray-700">
                                        Preserve attributes from selected layers
                                    </label>
                                </div>

                                <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
                                    <i className="fas fa-info-circle mr-1"></i>
                                    Union will combine all selected features into a single new layer.
                                </div>
                            </div>
                        </ModalBody>

                        <ModalFooter>
                            <Button
                                color="danger"
                                variant="light"
                                onPress={onClose}
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleUnion}
                                size="sm"
                                disabled={selectedLayers.size < 2 || !outputName}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <i className="fas fa-object-group mr-1"></i>
                                Perform Union
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}